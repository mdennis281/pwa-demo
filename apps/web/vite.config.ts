import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'PWA Demo',
        short_name: 'PWADemo',
        description: 'A demo of modern PWA capabilities — service workers, push, websockets, web workers, install UX.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'browser'],
        orientation: 'any',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        lang: 'en',
        dir: 'ltr',
        categories: ['productivity', 'developer', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png',           sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',         sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',         sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Status',     short_name: 'Status', url: '/status',   description: 'Live connected clients' },
          { name: 'Web Worker', short_name: 'Worker', url: '/worker',   description: 'Web Worker demo' },
          { name: 'Push',       short_name: 'Push',   url: '/push',     description: 'Web Push demo' },
          { name: 'Manifest',   short_name: 'Manifest', url: '/manifest', description: 'PWA install playground' },
        ],
        protocol_handlers: [{ protocol: 'web+pwademo', url: '/?proto=%s' }],
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        edge_side_panel: { preferred_width: 480 },
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api':       { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
  build: {
    sourcemap: true,
  },
});
