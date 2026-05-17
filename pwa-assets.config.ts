import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset,
  images: ['apps/web/public/logo.svg'],
  overrideAssets: false,
  headLinkOptions: { preset: '2023' },
});
