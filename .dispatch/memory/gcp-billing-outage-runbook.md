---
name: gcp-billing-outage-runbook
description: yesweb.app 503 outages trace to disabled billing on yesweb-497913; two of three billing accounts are closed
type: project
updatedAt: 1786213575551
---
**Symptom:** `yesweb.app` AND the direct `*.run.app` origin both return 503, while `gcloud run revisions list` shows a healthy ACTIVE revision. That combination = billing, not code.

**Mechanism:** billing disabled → Secret Manager (a billable API) refuses reads → Cloud Run aborts at boot fetching `DATABASE_URL` → no instance ever starts → 503 on every request. Cloud SQL `yesweb-db` goes `SUSPENDED` at the same time.

**Diagnose:**
```
gcloud billing projects describe yesweb-497913
gcloud logging read 'resource.type="cloud_run_revision" AND "billing is disabled"' --project=yesweb-497913 --freshness=90d
```

**Billing accounts (as of 2026-08-08):** `010719-B4CC46-7E3E54` "My Billing Account" — **CLOSED**, was the linked one. `011F33-54F1A3-3E664C` "HackUNT" — **CLOSED**. `01C005-3389FB-A71613` "My Maps Billing Account" — **OPEN**, now linked to this project by the user's choice.

**Fix:** `gcloud billing projects link yesweb-497913 --billing-account=<open-acct>`, then force a new revision (the old one stays broken — it never booted):
`gcloud run deploy pwa-demo --image=us-central1-docker.pkg.dev/yesweb-497913/pwa-demo/pwa-demo:<git-sha> --region=us-central1`

**Gotcha:** a `SUSPENDED` Cloud SQL instance cannot be restarted (`HTTP 409`) — GCP reactivates it on its own schedule after billing returns. The API boots fine without it; `/api/tower/leaderboard` just returns `{"leaderboard":[]}`.

**Why:** This outage ran 2026-07-09 → 2026-08-08 unnoticed. Cost ~$9/mo of Cloud SQL to keep alive, so it can recur if that billing account closes too.
