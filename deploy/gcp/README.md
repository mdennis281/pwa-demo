# YesWeb on GCP Cloud Run

This is the second deploy target for the project (the LAN-box autodeploy is
the other one). It runs on GCP Cloud Run in `us-central1` (Iowa).

> **Why us-central1 and not us-south1 (Dallas)?** Cloud Run Domain Mappings
> aren't enabled in us-south1 yet, and we needed a native custom-domain
> setup for `yesweb.app` rather than a Cloudflare-Worker-as-Host-rewriter
> kludge. us-central1 adds ~20ms vs. us-south1 from Houston, which is
> imperceptible.

## TL;DR

- **Public URL:** https://yesweb.app — custom domain via Cloud Run Domain Mapping, Google-managed SSL
- **Backup URL:** https://pwa-demo-ruukiox65q-uc.a.run.app — the underlying Cloud Run service URL, always reachable
- **www:** `www.yesweb.app` 301-redirects to the apex via in-app Express middleware
- **Project:** `yesweb-497913`
- **Region:** `us-central1`
- **Auto-deploys** on every push to `main` via GitHub Actions (`.github/workflows/deploy.yml`)

## Architecture

One Cloud Run container serves everything — the React PWA static bundle and
the Express / Socket.io / web-push API are co-located so the browser's
parameter-less `io()` connects same-origin. Same layout as the LAN-box deploy.

```
                                  ┌───────────────────────────────────┐
       yesweb.app  ─►  Google     │  Cloud Run service: pwa-demo      │
                       edge   ───►│                                   │
       www.yesweb.app             │  Node 20 container                │
       (CNAME ghs.googlehosted)   │  ├─ Express  /api/* /socket.io    │
                                  │  └─ static   /app/apps/web/dist   │
                                  │                                   │
                                  │  runtime SA: pwa-demo-run         │
                                  │  --add-cloudsql-instances ────────┼──► Cloud SQL Postgres
                                  │  --set-secrets ─────────────────► │     yesweb-db (db-f1-micro)
                                  │     VAPID × 3 / ADMIN_TOKEN /     │
                                  │     DATABASE_URL / CANONICAL_HOST │
                                  └───────────────────────────────────┘
```

DNS lives at Cloudflare (DNS-only, **grey-cloud / no proxy**). Apex `yesweb.app`
uses 4 × A records to Google's `216.239.32-38.21` plus the IPv6 mirror set;
`www.yesweb.app` uses one CNAME → `ghs.googlehosted.com.`.

## GCP resources

| Kind | Name | Notes |
|---|---|---|
| Artifact Registry | `pwa-demo` (us-central1) | Docker images, tagged `latest` + `<short-sha>` |
| Cloud SQL Postgres 16 | `yesweb-db` | `db-f1-micro`, 10 GB SSD, zonal, daily backup 07:00 UTC |
| Cloud Run service | `pwa-demo` | min=1 / max=3, 512 MiB, 1 vCPU, session-affinity on |
| Cloud Run domain mapping | `yesweb.app`, `www.yesweb.app` | both → `pwa-demo` service, Google-managed cert |
| Secret Manager | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `ADMIN_TOKEN`, `DATABASE_URL` | mirrored at runtime as env vars |
| Service account | `pwa-demo-run` (runtime) | cloudsql.client, secretmanager.secretAccessor, logging.logWriter, monitoring.metricWriter |
| Service account | `pwa-demo-gha` (CI deployer) | cloudbuild.builds.editor, run.admin, artifactregistry.writer, iam.serviceAccountUser, storage.admin, browser, serviceusage.serviceUsageConsumer |

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) runs on every push to `main`
that touches code (the workflow's `paths-ignore` skips `.md`, `.planning/**`,
etc., so docs-only commits don't burn CI minutes).

Auth flow: the workflow uses the `pwa-demo-gha` SA key stored in the GH
secret `GCP_SA_KEY`. It then submits `cloudbuild.yaml`, which runs the
Docker build, pushes to Artifact Registry, and deploys the new Cloud Run
revision. All deploy logic lives in `cloudbuild.yaml` so the manual path
(`gcloud builds submit`) and CI share the recipe.

Manual deploy from your laptop:

```sh
gcloud builds submit \
  --project=yesweb-497913 \
  --region=us-central1 \
  --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA=$(git rev-parse --short HEAD) \
  .
```

The `concurrency: deploy-main` group in the workflow cancels any in-flight
deploy when a newer commit lands on main.

## Ops cookbook

### Tail prod logs

```sh
gcloud beta run services logs tail pwa-demo \
  --region=us-central1 --project=yesweb-497913
```

### Roll back to a previous revision

```sh
# list revisions
gcloud run revisions list --service=pwa-demo \
  --region=us-central1 --project=yesweb-497913

# point 100% traffic at a known-good one
gcloud run services update-traffic pwa-demo \
  --to-revisions=pwa-demo-00001-jj6=100 \
  --region=us-central1 --project=yesweb-497913
```

### Update a secret (e.g. rotate VAPID)

```sh
echo -n "$NEW_VALUE" | gcloud secrets versions add VAPID_PRIVATE_KEY \
  --data-file=- --project=yesweb-497913

# Cloud Run reads `:latest`, so the next revision picks it up. Force a
# refresh now without a code change:
gcloud run services update pwa-demo \
  --region=us-central1 --project=yesweb-497913 \
  --update-env-vars=ROTATE=$(date +%s)
```

### Read the prod DB

The DB only accepts connections via the Cloud SQL Auth Proxy (no public IP).

```sh
# one-time:
gcloud auth application-default login

# proxy in one terminal:
cloud-sql-proxy --address=127.0.0.1 --port=5433 \
  yesweb-497913:us-central1:yesweb-db

# psql in another (password is in Secret Manager: DATABASE_URL):
psql "postgres://pwademo@127.0.0.1:5433/pwademo"
```

### Apply a Drizzle schema change

```sh
# proxy in one shell as above; then:
DATABASE_URL="postgres://pwademo:$PW@127.0.0.1:5433/pwademo" \
  npm -w @pwa-demo/server run db:push
```

### Domain mapping inspection

```sh
gcloud beta run domain-mappings list \
  --region=us-central1 --project=yesweb-497913

gcloud beta run domain-mappings describe \
  --domain=yesweb.app --region=us-central1 --project=yesweb-497913
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
| Domain mappings | free | free |
| Cloudflare DNS | free | free |
| Egress | free under 1 GB/mo | + $0.12/GB |
| **Floor** | **~$16/mo** | + traffic |

To drop to scale-to-zero billing (no min instance), set `--min-instances=0`
in the `deploy` step of `cloudbuild.yaml`. Cold starts add 1–3s to the first
request after idle.

## Custom domain wiring (one-time, documented for future reference)

1. **Verify ownership** at Google Search Console (`gcloud domains verify yesweb.app`) by adding a TXT record at the DNS provider.
2. **Create the mappings** — `gcloud beta run domain-mappings create --domain=yesweb.app --region=us-central1 --service=pwa-demo` (and `--domain=www.yesweb.app`). gcloud spits out the A/AAAA records for apex and the CNAME for www.
3. **At Cloudflare** (DNS-only, grey cloud — never orange when behind a native Cloud Run mapping): add the records.
4. **Wait** for the cert to provision (~15 min). Status: `gcloud beta run domain-mappings describe --domain=yesweb.app ...` → `CertificateProvisioned=True`.
5. **Edge propagation** then takes another 5–15 min before all of Google's anycast IPs serve the cert reliably.
