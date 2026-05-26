import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

// Brand background — matches manifest.theme_color and the logo gradient base.
// Used to fill transparent areas in apple-touch-icon and splash screens so
// the corners of our rounded logo aren't framed in white.
const BRAND_BG = '#0f172a';

// Extend the standard preset:
//   1. Emit pwa-96x96.png (Chrome wants exactly 96 for shortcut jumplist icons)
//   2. Override the apple-touch-icon background so transparent corners pick
//      up the brand navy instead of the default white (defaultResizeOptions
//      ships background:'white', which produces a visible white border on
//      iOS home screen because logo.svg has rx="96" rounded corners).
const basePreset = {
  ...minimal2023Preset,
  transparent: {
    ...minimal2023Preset.transparent,
    sizes: [...minimal2023Preset.transparent.sizes, 96],
  },
  apple: {
    ...minimal2023Preset.apple,
    resizeOptions: { fit: 'contain' as const, background: BRAND_BG },
  },
};

// Add iOS splash screens. Without these, launching the installed PWA on
// iOS shows a blank white screen until first paint — there's no equivalent
// of Android's manifest-driven splash. The generator emits one PNG per
// device + orientation; index.html declares the matching media queries.
// Files are named via defaultSplashScreenName ↦
//   apple-splash-{portrait|landscape}-{width}x{height}.png
const preset = combinePresetAndAppleSplashScreens(basePreset, {
  padding: 0.45,
  resizeOptions: { fit: 'contain' as const, background: BRAND_BG },
});

export default defineConfig({
  preset,
  images: ['apps/web/public/logo.svg'],
  overrideAssets: false,
  headLinkOptions: { preset: '2023' },
});
