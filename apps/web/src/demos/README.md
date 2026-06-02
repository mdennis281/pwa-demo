# Demos framework

The mechanics behind the ~60 demos that make up YesWeb. Every demo in the app is registered here, and the routing, navigation, favorites, and modal-mounting all derive from a single registry.

## Adding a new demo

Three steps. The whole flow is type-checked and tree-shaken.

### 1. Create the component

`./<category-slug>/<demo-id>.tsx` — one file, default-exported React component.

- **For modal demos** (53 of them) — render *body content only*. No outer `<div>` with padding or max-width. `ModalHost` provides the title/blurb/close/star chrome around your component.
- **For page demos** (8 of them) — wrap your top-level return in `<DemoPage id="..." title="..." blurb="...">`. That gives you back/overview links, the title header, and the star toggle for free.
- **For multi-page demos** (currently just Tower Climb) — wrap with `<DemoPage hideChrome>` if your demo wants its own fullscreen UI; otherwise treat as a page demo and manage internal sub-navigation via component state or nested routes.

Use the shared vocabulary in [`_shared/ui.tsx`](_shared/ui.tsx) — `Btn` (primary/ghost), `Out` (readout line), `Row` (key/value display). It keeps the look consistent across the demo collection.

### 2. Add a registry entry

In [`_registry.ts`](_registry.ts), append a `DemoSpec`:

```ts
{
  id: 'vibration',                                                // URL slug, must be unique
  title: 'Vibrate device',                                        // ACTION verb, not the tech name
  blurb: 'Vibrate the device with a pattern.',                    // One-line description
  type: 'modal',                                                  // 'modal' | 'page' | 'multi-page'
  category: 'Notifications',                                      // see capabilities.ts for the canonical list
  capabilities: ['vibration'],                                    // which capability ids this demo exercises (M:N)
  component: lazy(() => import('./notifications/vibration')),     // matches the file path you just created
},
```

### 3. Done

The sidebar, the per-category page, the `App.tsx` routes, and the favorites lookup all derive from the registry. No other files to touch.

## Routing model

| Type | URL | Mounted by |
|---|---|---|
| `modal` | `?demo=<id>` query param on top of any route | [`_ModalHost.tsx`](_ModalHost.tsx) reading `location.search` |
| `page` | `/d/<id>` | `App.tsx` generates `<Route>` from the registry |
| `multi-page` | `/d/<id>/*` (wildcard for internal sub-routing) | Same — wildcard added when `type === 'multi-page'` |

The `?demo=<id>` modal scheme means modal demos are **deep-linkable** without affecting which page you're on. Open `?demo=vibration` from anywhere; closing the modal removes the param and you're back on the underlying route.

Cold loads resolve the same way: the server's SPA fallback (`app.get('*')`) and the service worker's `NavigationRoute` both serve `index.html` for any non-`/api` path, so pasting `/d/tower-climb` (or `/?demo=vibration`) into a fresh tab — online *or* offline — boots the app and routes client-side. Every demo's chrome carries a **Share / copy-link** button (`_ShareButton.tsx`) that hands the canonical absolute URL (`deepLinkFor()`) to the Web Share API, falling back to the clipboard. Fullscreen demos that skip `<DemoPage>` (Tower Climb) manage their own chrome and don't show it, but their `/d/<id>` link still works.

Legacy paths (`/wco`, `/push`, `/passkeys`, `/islands`, `/speech-echo`, `/indexed-db`, `/manifest`, `/status`, `/worker`, `/game`) are mapped to the new `/d/<id>` form via redirects in `App.tsx`, so old bookmarks still work.

## Framework files (`_` prefix)

| File | Purpose |
|---|---|
| [`_types.ts`](_types.ts) | `DemoSpec`, `DemoType`, `pagePathFor()`, `modalQueryFor()`, `deepLinkFor()` |
| [`_registry.ts`](_registry.ts) | The `DEMOS` array — source of truth for everything else; lookup helpers (`demoById`, `demosForCapability`, `demosForCategory`) |
| [`_favorites.ts`](_favorites.ts) | IndexedDB-backed favorites store (`useFavorites` hook, cross-tab `BroadcastChannel` sync) |
| [`_ModalHost.tsx`](_ModalHost.tsx) | URL-driven modal renderer; ESC + backdrop close; body-scroll lock |
| [`_DemoPage.tsx`](_DemoPage.tsx) | Page-demo wrapper: back link, title, star, max-width content area |
| [`_OpenDemo.tsx`](_OpenDemo.tsx) | `<OpenDemoLink>` — picks `?demo=` vs `/d/` based on type; `useIsDemoActive` hook |
| [`_StarButton.tsx`](_StarButton.tsx) | Reusable favorite toggle (★/☆) — `sm` and `md` sizes |
| [`_ShareButton.tsx`](_ShareButton.tsx) | Share / copy-link button — Web Share API with clipboard fallback; sits beside the star in modal + page chrome |
| [`_shared/ui.tsx`](_shared/ui.tsx) | `Btn`, `Out`, `Row` — the demo UI vocabulary |
| [`_shared/b64.ts`](_shared/b64.ts) | base64url encode/decode (used by WebAuthn / passkey demos) |

## Folder structure

One folder per capability category (slug-cased). All demos for that category live there:

```
demos/
├─ _registry.ts            ← source of truth
├─ _types.ts
├─ _favorites.ts
├─ _ModalHost.tsx
├─ _DemoPage.tsx
├─ _OpenDemo.tsx
├─ _StarButton.tsx
├─ _shared/
│   ├─ ui.tsx
│   └─ b64.ts
├─ background-lifecycle/   ← 5 demos
├─ graphics-compute/       ← 8 demos
├─ hardware/               ← 4 demos
├─ identity-payments/      ← 5 demos
├─ input-ux/               ← 8 demos
├─ install-pwa/            ← 5 demos
├─ media/                  ← 6 demos
├─ networking/             ← 5 demos
├─ notifications/          ← 4 demos
├─ sensors/                ← 6 demos
└─ storage-files/          ← 6 demos
```

62 demos total: **53 modal**, **8 page**, **1 multi-page**.

## Capability ↔ demo (M:N)

A capability (defined in [`../lib/capabilities.ts`](../lib/capabilities.ts)) is a *browser feature* — `service-worker`, `webgl`, `push`, etc. A demo *exercises* one or more capabilities, declared via `capabilities: string[]` on the `DemoSpec`.

The relationship is many-to-many:

- One capability can be touched by several demos. E.g., `webauthn` is exercised by both [`identity-payments/webauthn.tsx`](identity-payments/webauthn.tsx) (a quick 30-line modal) *and* [`identity-payments/passkeys.tsx`](identity-payments/passkeys.tsx) (a full diagnostic `/d/passkeys` page).
- One demo can cover several capabilities. The multi-cap demos today:
  - `push` → `['push', 'notifications']`
  - `islands` (Floating Islands 3D scene) → `['motion', 'orientation']`
  - `tower-climb` → `['webgl', 'websocket', 'gamepad']`

  The three speech demos (`speech-rec`, `speech-syn`, `speech-echo`) all map to the single `speech` capability, so they're listed together under one "Speech (STT & TTS)" row.

Lookup helpers in [`_registry.ts`](_registry.ts):

```ts
demosForCapability(capId): DemoSpec[]
demosForCategory(category): DemoSpec[]
demoById(id): DemoSpec | undefined
```

## Favorites

[`_favorites.ts`](_favorites.ts) backs a `useFavorites()` hook with an IndexedDB store at `pwa-demo-prefs` → `favorites` (keyPath `id`). Cross-tab sync via a `BroadcastChannel`. Degrades silently if IDB is unavailable (e.g., private mode).

The Home page surfaces favorites as a section above the category grid (hidden when empty). The sidebar intentionally does NOT show favorites — it's pure category navigation, no demo openers. Star buttons appear:

- In the modal/page chrome (top-right of the header)
- On the chips in the per-category page
- On the favorite cards on Home

## Naming convention

The registry's `title` field is an **action**, not a technology name. Why: the capability already names the tech ("Vibration", "WebAuthn / Passkeys"). The demo's title should describe what *this* particular demo does:

| Capability name | Demo title |
|---|---|
| Vibration | "Vibrate device" |
| Geolocation | "Get position" |
| Web Bluetooth | "Pair a BLE device" |
| WebAuthn (modal) | "Quick register & sign-in" |
| WebAuthn (page) | "Full diagnostic" |
| Payment Request | "Probe & show sheet" |
| WebGL (triangle) | "Animated triangle" |
| WebGL (instanced) | "Instanced rendering" |

Multi-cap demos that exercise several techs at once get proper-noun names (Tower Climb, Floating Islands, Speech Echo Loop) — they're branded experiences spanning multiple capabilities, not single-API demonstrations.

## Modal vs page judgment call

If the demo fits in ~150 lines, is one screen, and is essentially `[buttons] + [readout]` → make it a modal.

If it has multiple sections, a non-trivial UI, or wants to be fullscreen / immersive → make it a page.

If it has *internal sub-navigation* (a wizard, a list-then-detail flow, multiple stages with their own state) → make it multi-page.
