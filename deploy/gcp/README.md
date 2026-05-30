# pwa-demo on GCP Cloud Run

This is the second deploy target for pwa-demo (the LAN-box autodeploy is the
other one). It runs on GCP Cloud Run in `us-south1` (Dallas — closest region
to Houston).

## TL;DR

- **Live URL:** https://pwa-demo-ruukiox65q-vp.a.run.app
- **Project:** `yesweb-497913`
- **Region:** `us-south1`
- **Auto-deploys** on every push to `main` via GitHub Actions
  (`.github/workflows/deploy.yml`)

## Architecture

One Cloud Run container serves everything — the React PWA static bundle and
the Express / Socket.io / web-push API are co-located so the browser's
`io()` (no URL) connects same-origin. Same layout as the LAN-box deploy.

```
                                  ┌───────────────────────────────────┐
                                  │  Cloud Run service: pwa-demo      │
                                  │                                   │
       browser (https) ───────────►  Node 20 container                │
                                  │  ├─ Express  /api/* /socket.io    │
                                  │  └─ static   /app/apps/web/dist   │
                                  │                                   │
                                  │  runtime SA: pwa-demo-run         │
                                  │  --add-cloudsql-instances ────────┼──► Cloud SQL Postgres
                                  │  --set-secrets ─────────────────► │     pwa-demo-pg (db-f1-micro)
                                  │     VAPID × 3 / ADMIN_TOKEN /     │
                                  │     DATABASE_URL                  │
                                  └───────────────────────────────────┘
```

## GCP resources

| Kind | Name | Notes |
|---|---|---|
| Artifact Registry | `pwa-demo` (us-south1) | Docker images, tagged `latest` + `<short-sha>` |
| Cloud SQL Postgres 16 | `pwa-demo-pg` | `db-f1-micro`, 10 GB SSD, zonal, daily backup 07:00 UTC |
| Cloud Run service | `pwa-demo` | min=1 / max=3, 512 MiB, 1 vCPU, session-affinity on |
| Secret Manager | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `ADMIN_TOKEN`, `DATABASE_URL` | mirrored at runtime as env vars |
| Service account | `pwa-demo-run` (runtime) | cloudsql.client, secretmanager.secretAccessor, logging.logWriter, monitoring.metricWriter |
| Service account | `pwa-demo-gha` (CI deployer) | cloudbuild.builds.editor, run.admin, artifactregistry.writer, iam.serviceAccountUser, storage.admin, browser, serviceusage.serviceUsageConsumer |

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) runs on every push to `main`.
The workflow auths to GCP via the `pwa-demo-gha` SA key (stored in the repo
secret `GCP_SA_KEY`), then submits `cloudbuild.yaml` to Cloud Build, which
in turn builds → pushes → deploys.

All deploy logic lives in `cloudbuild.yaml` so you can also kick off a
deploy from your laptop:

```sh
gcloud builds submit \
  --project=yesweb-497913 \
  --region=us-south1 \
  --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA=$(git rev-parse --short HEAD) \
  .
```

The `concurrency: deploy-main` group in the workflow cancels any in-flight
deploy when a newer commit lands.

## Ops cookbook

### Tail prod logs

```sh
gcloud beta run services logs tail pwa-demo \
  --region=us-south1 --project=yesweb-497913
```

### Roll back to a previous revision

```sh
# list revisions
gcloud run revisions list --service=pwa-demo \
  --region=us-south1 --project=yesweb-497913

# point 100% traffic at a known-good one
gcloud run services update-traffic pwa-demo \
  --to-revisions=pwa-demo-00001-55j=100 \
  --region=us-south1 --project=yesweb-497913
```

### Update a secret (e.g. rotate VAPID)

```sh
echo -n "$NEW_VALUE" | gcloud secrets versions add VAPID_PRIVATE_KEY \
  --data-file=- --project=yesweb-497913

# Cloud Run reads `:latest` so the next revision picks it up automatically.
# Force a refresh without code change:
gcloud run services update pwa-demo \
  --region=us-south1 --project=yesweb-497913 \
  --update-env-vars=ROTATE=$(date +%s)
```

### Read the prod DB

The DB only accepts connections via the Cloud SQL Auth Proxy (no public IP).
Run the proxy locally:

```sh
# one-time: gcloud auth application-default login
cloud-sql-proxy --address=127.0.0.1 --port=5433 \
  yesweb-497913:us-south1:pwa-demo-pg

# in another shell:
psql "postgres://pwademo@127.0.0.1:5433/pwademo"
# password is in Secret Manager: DATABASE_URL secret, extract from the URL
```

### Apply a Drizzle schema change

```sh
# proxy in one shell as above; then:
DATABASE_URL="postgres://pwademo:$PW@127.0.0.1:5433/pwademo" \
  npm -w @pwa-demo/server run db:push
```

### Manually trigger an autodeploy

```sh
gh workflow run deploy.yml --ref main --repo mdennis281/pwa-demo
gh run watch --repo mdennis281/pwa-demo
```

## Cost ballpark

| Component | At idle | Under demo traffic |
|---|---|---|
| Cloud Run (min=1) | ~$5/mo (1 always-on small instance) | + ~$0.0001/req |
| Cloud SQL `db-f1-micro` | ~$9/mo | ~$9/mo |
| Cloud SQL storage (10 GB SSD) | ~$1.70/mo | ~$1.70/mo |
| Artifact Registry storage | ~$0.10/mo per GB | same |
| Secret Manager | free under 6 active secrets | same |
| Egress | free under 1 GB/mo | + $0.12/GB |
| **Floor** | **~$16/mo** | + traffic |

To drop to scale-to-zero billing (no min instance), set `--min-instances=0`
in the `deploy` step of `cloudbuild.yaml`. Cold starts add 1–3s to the first
request after idle.

## First-time bootstrap (for future projects)

The full provisioner is not checked in (mostly one-shot gcloud commands).
The high-level order was:

1. `gcloud config set project yesweb-497913`
2. Link billing account (`gcloud beta billing projects link`)
3. Enable APIs: run, cloudbuild, artifactregistry, sqladmin, secretmanager, iam
4. Create the Artifact Registry repo, the runtime SA, the deployer SA, IAM bindings
5. Create the Cloud SQL instance + DB + user
6. Create Secret Manager entries from `.env`
7. Create deployer SA key, set as GH secret `GCP_SA_KEY`, set repo secret `GCP_PROJECT_ID`
8. First `gcloud builds submit` to create the Cloud Run service, then add `allUsers` invoker binding
