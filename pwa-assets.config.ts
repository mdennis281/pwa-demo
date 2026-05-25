import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Extend the standard preset to also emit pwa-96x96.png. Chrome's manifest
// validator specifically wants a 96x96 icon on each shortcut entry — pointing
// at the 192x192 instead produces a "should include a 96x96 pixel icon"
// warning and Chrome won't surface the shortcut on the OS jumplist.
const preset = {
  ...minimal2023Preset,
  transparent: {
    ...minimal2023Preset.transparent,
    sizes: [...minimal2023Preset.transparent.sizes, 96],
  },
};

export default defineConfig({
  preset,
  images: ['apps/web/public/logo.svg'],
  overrideAssets: false,
  headLinkOptions: { preset: '2023' },
});
