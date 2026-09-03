---
name: wco-fullscreen-overlay-rule
description: Any fixed full-viewport overlay in apps/web must start at top-[var(--wco-h)], not inset-0, or it collides with the Window Controls Overlay titlebar
type: project
updatedAt: 1788451368260
---
The app shell (`components/Layout.tsx`) reserves the WCO titlebar strip with `pt-[var(--wco-h)]`. Anything `position: fixed` escapes that padding and runs full-bleed to the top of the window, so under Window Controls Overlay it lands under the app-drawn strip (`components/WcoTitlebar`, z-60) and the OS minimize/maximize/close buttons.

**Rule:** write fixed full-viewport overlays as

```
fixed inset-x-0 bottom-0 top-[var(--wco-h)]
```

not `fixed inset-0`. `--wco-h` is `env(titlebar-area-height, 0px)` — 0px in every other display mode — so this is inert outside an installed desktop PWA and needs no JS check.

Two symptoms when you get it wrong, both seen for real:
- Content clipped/hidden behind the strip.
- The strip is `app-region: drag`, so any button underneath it stops responding — clicks move the window instead. A modal backdrop over it also leaves the window unmovable until dismissed.

Fixed so far: `demos/_ModalHost.tsx` (commit dcb3b75) and `game/GameCanvas.tsx` play screen (commit 5d5a0a2). Still `inset-0` and unfixed on purpose: `game/WorldPreview.tsx` (dev-only headless screenshot harness, never runs under WCO). The `fixed inset-0 z-50` backdrops in `game/AdminMenu.tsx` / `game/lobby/ServerAdminMenu.tsx` sit *below* the z-60 strip, so they neither dim it nor swallow the drag region — they're fine as-is.

**Why:** this class of bug is invisible in a normal dev tab and has now been hit twice in different components; grep for `fixed inset-0` before adding a new overlay.

Test it with [[wco-local-testing-harness]].
