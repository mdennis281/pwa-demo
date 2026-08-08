---
name: yesweb-identity-and-repo
description: YesWeb is the rebranded name for the mdennis281/pwa-demo repo and the yesweb-497913 GCP project — there is no repo named "yesweb"
type: project
updatedAt: 1786213561798
---
The local checkout `C:\Users\Michael\projects\yesweb` tracks **`github.com/mdennis281/pwa-demo`** (default branch `main`). There is no GitHub repo named `yesweb` — searching for one is a dead end.

"YesWeb" is the rebrand (May 2026) and is also the **GCP project name**: project ID `yesweb-497913`, number `356003928918`. Internal package names (`@pwa-demo/*`), the Artifact Registry path, and the Cloud Run service are all still `pwa-demo` for backward compat.

Live at **yesweb.app**, served from a single Node container on Cloud Run (`us-central1`), backup origin `pwa-demo-356003928918.us-central1.run.app`.

Layout: npm workspaces monorepo — `apps/web` (Vite 7 + React 19 + Tailwind 4 PWA), `apps/server` (Express + Socket.io + web-push + Drizzle/Postgres), `apps/bots` (headless load-test clients), `packages/shared` (TS types).

**Why:** A whole session was burned searching GitHub and nearly scaffolding a new app from scratch, because the directory name matches neither the repo nor any searchable remote.
