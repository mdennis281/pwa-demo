// Generate placeholder install-prompt screenshots for the PWA manifest.
//
// Chrome (and other Chromium installs) show a richer install dialog with a
// preview carousel when the manifest declares `screenshots` with the right
// `form_factor`. Without them, the install UI is the spartan one-liner and
// Chrome's manifest validator prints a "Richer PWA Install UI won't be
// available" warning. These rendered SVG-to-PNG placeholders satisfy the
// validator and look intentional rather than empty. Swap them for real app
// screenshots whenever convenient — no code changes needed, just drop new
// PNGs at the same paths.
//
// Idempotent: rewrites the same two files on every run. Cheap (~50ms).

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'apps/web/public/screenshots');

const APP_NAME = 'YesWeb';
const TAGLINE = 'Modern web platform capabilities, in one place.';

/** Hand-crafted branded screenshot. Mirrors the logo.svg palette so the
 *  install dialog feels consistent with the app shell. */
function buildSvg({ width, height, isWide }) {
  const logoSize = Math.round(Math.min(width, height) * (isWide ? 0.22 : 0.32));
  const titleSize = Math.round(Math.min(width, height) * (isWide ? 0.085 : 0.085));
  const taglineSize = Math.round(Math.min(width, height) * (isWide ? 0.032 : 0.034));
  const waveScale = isWide ? 1.6 : 1.8;
  // Stack: logo → title → tagline, vertically centered.
  const centerY = height / 2;
  const logoY = centerY - logoSize * 0.85;
  const titleY = centerY + logoSize * 0.6;
  const taglineY = titleY + titleSize * 0.85;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <g transform="translate(${width / 2} ${centerY - 20}) scale(${waveScale})" fill="none" stroke="url(#wave)" stroke-linecap="round" stroke-width="10" opacity="0.6">
    <path d="M -150 30 Q -110 -50, -70 30 T 10 30 T 90 30 T 170 30" opacity="0.25"/>
    <path d="M -150 60 Q -110 -20, -70 60 T 10 60 T 90 60 T 170 60" opacity="0.45"/>
    <path d="M -150 90 Q -110 10,  -70 90 T 10 90 T 90 90 T 170 90" opacity="0.7"/>
  </g>
  <g transform="translate(${width / 2} ${logoY})">
    <rect x="${-logoSize / 2}" y="${-logoSize / 2}" width="${logoSize}" height="${logoSize}"
          rx="${Math.round(logoSize / 5)}" fill="#0f172a"
          stroke="rgba(56,189,248,0.35)" stroke-width="2"/>
    <text x="0" y="${Math.round(logoSize * 0.25)}" text-anchor="middle"
          font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-weight="800" font-size="${Math.round(logoSize * 0.7)}" fill="#f8fafc"
          letter-spacing="-4">P</text>
  </g>
  <text x="${width / 2}" y="${titleY}" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-weight="800" font-size="${titleSize}" fill="#f8fafc" letter-spacing="-2">${APP_NAME}</text>
  <text x="${width / 2}" y="${taglineY}" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-weight="400" font-size="${taglineSize}" fill="#94a3b8">${TAGLINE}</text>
</svg>`;
}

const targets = [
  // Desktop / "wide" form factor. 1280x720 is a common Chrome carousel size
  // and is well within the spec's 320–3840 range.
  { name: 'screenshot-wide.png', width: 1280, height: 720, isWide: true },
  // Mobile / "narrow" form factor. ~9:16 portrait mirrors a phone preview.
  { name: 'screenshot-narrow.png', width: 720, height: 1280, isWide: false },
];

await mkdir(OUT_DIR, { recursive: true });
for (const t of targets) {
  const svg = buildSvg(t);
  const out = path.join(OUT_DIR, t.name);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
  console.log(`  generated ${path.relative(REPO_ROOT, out)} (${t.width}x${t.height})`);
}
