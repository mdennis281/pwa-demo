---
name: yesweb-local-dev-startup
description: The `dev` subApp reports "running" even when the API died on missing VAPID keys — run `npm run gen:vapid` once to create .env, or anything socket-backed shows "ws disconnected"
type: project
updatedAt: 1788451391055
---
`npm run dev` (and the Dispatch `dev` subApp) runs Vite :5173 and the API :3000 under one `concurrently`. If the API crashes, **the subApp still reports "running"** because Vite is alive — the only visible symptom is `ws disconnected` in the sidebar and no lobbies on `/d/tower-climb`.

The usual cause on a fresh checkout is a missing `.env`: `apps/server` zod-validates `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` at boot and exits if they're unset. Fix once:

```
npm run gen:vapid   # writes .env (gitignored)
```

Postgres is genuinely optional — without `db:up` the API boots and logs `[db] ... failed:` / `read leaderboard failed` on a loop, and the leaderboard degrades to empty. That noise is expected, not the problem.

Confirm the API is actually up rather than trusting the subApp status:

```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health   # 200
```

**Why:** the "running" status plus a working web UI makes a dead API look like a frontend bug; this cost a debug cycle. README documents `gen:vapid` but not that the API hard-exits without it.
