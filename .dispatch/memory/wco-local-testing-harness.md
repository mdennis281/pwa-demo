---
name: wco-local-testing-harness
description: How to test Window Controls Overlay features locally without installing the PWA — fake it with a matchMedia override plus injected env() geometry
type: project
updatedAt: 1788371259407
---
Window Controls Overlay only activates in an installed desktop PWA whose user has clicked the ⌃ "Hide title bar" button, so WCO features (`components/WcoTitlebar`, `lib/wco`, `lib/wcoTakeover`, the `wco` and `wco-takeover` demos) can't be exercised in a plain dev tab. To test them in a headless/driven browser:

1. Load the page with an **init script** (chrome-devtools MCP `navigate_page({ initScript })` — it must run before app modules) that overrides `window.matchMedia` to return `{ matches: true, addEventListener(){}, removeEventListener(){}, ... }` for exactly `'(display-mode: window-controls-overlay)'` and delegates everything else to the real one.
2. After load, inject CSS — `env(titlebar-area-*)` cannot be faked, so the strip computes to 0px tall:
   ```css
   :root { --wco-h: 33px !important }
   .wco-titlebar { top:0 !important; left:0 !important; width:calc(100% - 140px) !important; height:33px !important }
   ```
   33px ≈ the real Windows strip height; the 140px gap stands in for the OS window buttons.

Gotchas:
- Do NOT append the style inside the init script — `document.documentElement` is null that early, the append throws, and everything after it in the script silently never runs.
- `navigator.windowControlsOverlay` is genuinely present in ordinary Chromium desktop tabs, so it is useless as an "is WCO on" signal and needs no stubbing. `lib/wco`'s `wcoStatus()` distinguishes `tab` from `inactive` for exactly this reason.

**Why:** without this, verifying anything in the titlebar strip means manually installing the PWA and toggling the overlay by hand every time.
