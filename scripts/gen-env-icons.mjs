// Generate per-environment tinted PWA icon variants.
//
// One Cloud Run container serves yesweb.app (prod), pwa.dipduo.com (the "test"
// fallback domain), and localhost (dev). Each gets its own PWA identity via a
// per-Host manifest (apps/server/src/pwaManifest.ts). To make them visually
// distinct in Chrome's deep-link "open with" picker — and on the home screen —
// we hue-rotate the base sky-blue icon set into a per-env color and reference
// the variant from that env's manifest.
//
// Reads the base icons emitted by `gen:assets` (pwa-assets-generator) and
// writes `<name>-test.png` / `<name>-dev.png` next to them. prod uses the base
// icons unchanged (hue 0, no suffix), so nothing is emitted for it. Covers the
// manifest icons (pwa-* / maskable-*) AND the iOS apple-touch-icon, which iOS
// uses for the home-screen install instead of the manifest icons.
//
// Idempotent: rewrites the same files every run. Must run AFTER `gen:assets`
// (the base PNGs must already exist) and BEFORE `vite build` copies public/
// into dist. Cheap (~12 small PNGs, sharp only — no headless browser).

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(REPO_ROOT, 'apps/web/public');

// MIRROR of the non-prod entries of PWA_ENVS in packages/shared/src/index.ts
// (this is a plain .mjs build script and can't import the TS source). Keep the
// suffix + hue in sync with shared.
const ENVS = [
  { suffix: '-test', hue: 95 },  // pwa.dipduo.com → violet
  { suffix: '-dev', hue: 200 },  // localhost / run.app → warm amber
];

// Every icon the manifest references via icons[] or shortcuts[].icons[], plus
// the iOS home-screen icon (apple-touch-icon, swapped per-env at runtime in
// apps/web/src/lib/env.ts). Screenshots and splash assets are left untinted.
const BASE_ICONS = [
  'pwa-64x64.png',
  'pwa-96x96.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'maskable-icon-512x512.png',
  'apple-touch-icon-180x180.png',
];

let count = 0;
for (const { suffix, hue } of ENVS) {
  for (const file of BASE_ICONS) {
    const src = path.join(PUBLIC_DIR, file);
    const out = path.join(PUBLIC_DIR, file.replace(/\.png$/i, `${suffix}.png`));
    await sharp(src)
      .modulate({ hue }) // rotate hue across the whole icon, preserving alpha
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`  generated ${path.relative(REPO_ROOT, out)} (hue +${hue}°)`);
    count++;
  }
}
console.log(`gen:env-icons — wrote ${count} tinted icon variants`);
