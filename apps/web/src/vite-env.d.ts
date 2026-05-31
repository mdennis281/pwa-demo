/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build-time constants injected via `define` in vite.config.ts. Available in
// both the app bundle and the service worker build.
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
