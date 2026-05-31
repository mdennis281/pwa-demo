import { resolvePwaEnv, type PwaEnv } from '@pwa-demo/shared';

/**
 * The PWA environment for the current origin (prod / test / dev), resolved from
 * the hostname:
 *   prod → yesweb.app        test → pwa.dipduo.com        dev → localhost / run.app
 *
 * Drives the in-app branding (env badge, per-env logo tint, browser
 * theme-color). The *installed-app* identity (manifest name/short_name/icons)
 * is differentiated separately, server-side, per Host — see
 * apps/server/src/pwaManifest.ts. Both read the same `resolvePwaEnv` table in
 * @pwa-demo/shared so the running app and its installed manifest agree.
 */
export const pwaEnv: PwaEnv = resolvePwaEnv(
  typeof window !== 'undefined' ? window.location.hostname : '',
);

/**
 * Apply this env's identity to the document's branding tags once at startup
 * (called from main.tsx). index.html ships static prod values; this overrides
 * them per env. Covers three things iOS/Android read from the LIVE DOM at
 * install / "Add to Home Screen" time:
 *
 *  - <meta name="theme-color">         — browser UI, task switcher, splash, title bar
 *  - <meta name="apple-mobile-web-app-title"> — iOS home-screen NAME (overrides
 *      the manifest short_name on iOS, so it must be tinted too)
 *  - <link rel="apple-touch-icon">     — iOS home-screen ICON (iOS uses this,
 *      not the manifest icons), pointed at this env's tinted variant
 *
 * Android/desktop Chrome get their name + icons from the per-Host manifest
 * (apps/server/src/pwaManifest.ts); these apple-* tags are what make iOS match.
 */
export function applyEnvBranding(): void {
  if (typeof document === 'undefined') return;

  setMeta('theme-color', pwaEnv.themeColor);
  setMeta('apple-mobile-web-app-title', pwaEnv.name);

  // prod uses the base icon (empty suffix); test/dev point at the hue-tinted
  // apple-touch-icon-180x180-{test,dev}.png produced by gen:env-icons.
  const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (appleIcon) {
    appleIcon.href = `/apple-touch-icon-180x180${pwaEnv.iconSuffix}.png`;
  }
}

/** Upsert a <meta name=…> and set its content. */
function setMeta(name: string, content: string): void {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

/** CSS filter that tints the in-app sky-blue logo to match this env's icon,
 *  or `undefined` on prod (no rotation). Apply to the sidebar/header logo img. */
export const envLogoFilter: string | undefined = pwaEnv.iconHue
  ? `hue-rotate(${pwaEnv.iconHue}deg)`
  : undefined;
