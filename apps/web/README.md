# `@pwa-demo/web` — YesWeb frontend PWA

The React SPA + service worker that users interact with. ~60 live demos covering web platform capabilities, organized by category, plus a 3D multiplayer game.

## What lives here

```
src/
├─ App.tsx                  Routes. Generated from the demos registry.
├─ main.tsx                 Entry, Workbox SW registration
├─ sw.ts                    Custom service worker (Workbox injectManifest)
├─ components/
│   ├─ Layout.tsx           App shell — mobile header + desktop sidebar
│   ├─ DemoSidebar.tsx      Pure navigation; categories + capability links
│   ├─ ConnectionBadge.tsx  Network / WS status; click to fake-offline
│   ├─ InstallPrompt.tsx    beforeinstallprompt capture + UI
│   └─ FlowField.tsx        Particle flow field for the Web Worker demo
├─ demos/                   62 demos + framework — see demos/README.md
├─ game/                    Tower Climb 3D client — see game/README.md
├─ lib/
│   ├─ capabilities.ts      ~70 web platform capability definitions
│   ├─ useCapabilityStatuses.ts
│   ├─ install.ts           beforeinstallprompt singleton + helpers
│   ├─ push.ts              VAPID + subscribe/unsubscribe + delayed-send
│   └─ socket.ts            Singleton Socket.io client + admin token flow
├─ routes/
│   ├─ Home.tsx             Overview — category cards + favorites section
│   └─ Category.tsx         /category/<slug> — capabilities + demo chips
└─ workers/
    └─ compute.worker.ts    Prime sieve for the Web Worker demo
```

## Routing model

There are exactly three flavors of route:

| Pattern | Type | Component |
|---|---|---|
| `/` | overview | `routes/Home.tsx` |
| `/category/:cat` | per-category listing | `routes/Category.tsx` |
| `/d/:id` (and `/d/:id/*`) | per-demo route | lazy-loaded from the demo registry |

Plus modal demos that mount via the `?demo=<id>` query string on top of any route — `_ModalHost.tsx` watches the URL and renders the right one.

Legacy paths from before the demos refactor (`/wco`, `/push`, `/passkeys`, `/islands`, `/speech-echo`, `/indexed-db`, `/manifest`, `/status`, `/worker`, `/game`) all redirect to the new `/d/<id>` form for backward-compatible bookmarks.

## PWA semantics

`vite-plugin-pwa` in **injectManifest mode**: Vite produces the precache manifest at build time, the SW source code is hand-written at [`src/sw.ts`](src/sw.ts).

- **Precache:** SPA shell + assets (~130 entries, ~3.5 MB pre-gzip).
- **Push handler:** decodes VAPID-signed payload, calls `showNotification`, broadcasts `push:received` / `push:shown` / `push:error` to clients via postMessage so the Web Push diagnostic UI can show whether the SW received the push even when the OS suppressed the popup.
- **Background Sync handler:** on `'pbs-demo'` sync event, drains the `pbs-queue` IndexedDB store, marks items synced, writes a `pbs-sync` checkpoint.
- **Background Fetch handler:** emits progress events for the Background Fetch demo's progress bar.

The manifest declares `display: standalone` with `display_override: ["window-controls-overlay", "standalone"]` so the WCO demo on desktop installs has something to opt into.

## Capabilities vs demos

Two related but distinct concepts:

- **Capability** (defined in [`lib/capabilities.ts`](src/lib/capabilities.ts)) — a *browser feature* with a sync `check()` and optional async `refine()`. Example: `webgl`, `notifications`, `service-worker`. Each capability has a category and a description.
- **Demo** (defined in [`demos/_registry.ts`](src/demos/_registry.ts)) — a *piece of UI* that exercises one or more capabilities. Each demo is a `modal`, `page`, or `multi-page` component.

The Home page tallies capability support; the Category page groups capabilities and shows their associated demo chips; the sidebar navigates among capabilities; the modal/page system opens demos.

M:N: one demo can cover several capabilities, one capability can have several demos. Examples:

- Push demo → `push` + `notifications`
- Floating Islands → `motion` + `orientation`
- Tower Climb → `webgl` + `webgl2` + `websocket` + `gamepad`
- WebAuthn → `webauthn` is exercised by both a 30-line modal demo *and* a full diagnostic page at `/d/passkeys`

See [`src/demos/README.md`](src/demos/README.md) for the full demo-authoring recipe.

## Socket.io contract

The client connects same-origin with no URL via [`lib/socket.ts`](src/lib/socket.ts):

```ts
socket = io({ autoConnect: true, transports: ['websocket', 'polling'] });
```

Types come from [`@pwa-demo/shared`](../../packages/shared) — the client and server share the same `ClientToServerEvents` / `ServerToClientEvents` definitions, so socket calls are fully type-safe end-to-end.

Admin elevation is sticky on a single socket: paste a token, the server stamps the socket's `isAdmin=true`, future events that require admin authority (`admin:action` against the Official Server) succeed until disconnect. The client persists the token in `localStorage` and re-elevates on reconnect transparently.

## Dev

```
npm -w @pwa-demo/web run dev
```

Vite on `:5173` with React HMR. The `vite.config.ts` proxies `/api` and `/socket.io` to `:3000` so the SPA-on-5173, API-on-3000 split during dev still feels same-origin.

## Build

```
npm -w @pwa-demo/web run build
```

Outputs to `apps/web/dist/`:

- `index.html` + hashed JS/CSS chunks under `assets/`
- `sw.js` (compiled service worker)
- `manifest.webmanifest` (PWA manifest with `display_override`)
- All `public/` assets passed through

`apps/server` picks up `apps/web/dist` and serves it via `express.static` in production.

## Notable conventions

- **No emojis in code unless requested.** UI uses Tailwind utility classes throughout, no CSS files.
- **Lazy imports everywhere** — every demo, every route is `React.lazy`. Initial bundle stays small; demos download on demand.
- **`Out`, `Btn`, `Row`** from `demos/_shared/ui.tsx` are the demo vocabulary. Custom styling per demo is rare and intentional.
- **`packages/shared` is raw TS** — imports work directly from Vite (no `import type` requirement), but the server side must use `import type` only.
