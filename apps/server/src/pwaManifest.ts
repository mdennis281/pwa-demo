import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Request, Response, RequestHandler } from 'express';

// ─── Per-host PWA identity ──────────────────────────────────────────────────
//
// One Cloud Run container serves yesweb.app, the pwa.dipduo.com fallback, and
// (locally) localhost from a SINGLE baked dist/manifest.webmanifest. Chrome's
// PWA `id` is already origin-scoped, so it treats each origin as a distinct
// installed app — which is why the deep-link "open with" picker lists three
// entries. They were indistinguishable because they shared one name + icon
// set. This handler rewrites name/short_name/theme/icons per Host so each env
// is legible (and tinted a different color).
//
// MIRROR of PWA_ENVS / resolvePwaEnv in packages/shared/src/index.ts. The
// shared package is consumed as raw TS source, so the *compiled* server can't
// import its runtime values (Node would try to load index.ts and crash — see
// the shared README + the isDedicatedLobbyId precedent in game/lobby.ts).
// Keep this table in sync with shared.

type ServerPwaEnv = {
  name: string;
  shortName: string;
  themeColor: string;
  iconSuffix: string;
};

function resolvePwaEnv(hostname: string): ServerPwaEnv {
  const h = (hostname || '').toLowerCase().split(':')[0];
  if (h === 'yesweb.app' || h === 'www.yesweb.app')
    return { name: 'YesWeb', shortName: 'YesWeb', themeColor: '#0f172a', iconSuffix: '' };
  if (h === 'pwa.dipduo.com')
    return { name: 'YesWeb Test', shortName: 'YesWeb Test', themeColor: '#2e1065', iconSuffix: '-test' };
  return { name: 'YesWeb Dev', shortName: 'YesWeb Dev', themeColor: '#451a03', iconSuffix: '-dev' };
}

// ─── Manifest patching ──────────────────────────────────────────────────────

type Icon = { src: string; [k: string]: unknown };
type Manifest = {
  name?: string;
  short_name?: string;
  theme_color?: string;
  background_color?: string;
  icons?: Icon[];
  shortcuts?: { icons?: Icon[]; [k: string]: unknown }[];
  [k: string]: unknown;
};

/** Insert the env suffix before the `.png` extension, preserving any leading
 *  slash and query string. `pwa-512x512.png` + `-test` ⇒ `pwa-512x512-test.png`.
 *  Only the icon variants the generator produces (pwa-*, maskable-*) are ever
 *  passed here; screenshots are left untouched. */
function suffixPng(src: string, suffix: string): string {
  if (!suffix) return src;
  return src.replace(/(\.png)(\?.*)?$/i, `${suffix}$1$2`);
}

function patchManifest(base: Manifest, env: ServerPwaEnv): Manifest {
  const m: Manifest = structuredClone(base);
  m.name = env.name;
  m.short_name = env.shortName;
  m.theme_color = env.themeColor;
  m.background_color = env.themeColor;
  if (env.iconSuffix) {
    if (Array.isArray(m.icons)) {
      m.icons = m.icons.map((i) => ({ ...i, src: suffixPng(i.src, env.iconSuffix) }));
    }
    if (Array.isArray(m.shortcuts)) {
      m.shortcuts = m.shortcuts.map((s) => ({
        ...s,
        icons: (s.icons ?? []).map((i) => ({ ...i, src: suffixPng(i.src, env.iconSuffix) })),
      }));
    }
  }
  return m;
}

/**
 * Build an Express handler that serves a per-Host PWA manifest. The base
 * manifest is read from `dist/manifest.webmanifest` once and cached; each
 * request returns a clone patched for the requesting host.
 *
 * Must be registered BEFORE `express.static(webDist)` so this wins over the
 * baked file, and the service worker must NOT precache `manifest.webmanifest`
 * (we dropped `webmanifest` from the vite-plugin-pwa globPatterns) or the
 * cached generic copy would shadow this at the network layer.
 */
export function createManifestHandler(webDist: string): RequestHandler {
  const manifestPath = path.join(webDist, 'manifest.webmanifest');
  let base: Manifest | null | undefined; // undefined = not yet read, null = read failed

  return (req: Request, res: Response, next): void => {
    if (base === undefined) {
      try {
        base = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
      } catch (err) {
        base = null;
        console.warn(`[pwa] could not read base manifest at ${manifestPath}:`, (err as Error).message);
      }
    }
    if (!base) return next(); // fall through to express.static / SPA fallback

    const env = resolvePwaEnv(req.hostname);
    const body = JSON.stringify(patchManifest(base, env));
    res.set('Content-Type', 'application/manifest+json; charset=utf-8');
    // Per-host body at a shared URL + no CDN in front (Cloudflare is DNS-only),
    // so revalidate every time rather than risk a stale cross-host copy.
    res.set('Cache-Control', 'no-cache');
    res.send(body);
  };
}
