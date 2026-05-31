import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import webpush from 'web-push';
import { Server } from 'socket.io';
import { env } from './env.js';
import { attachSocket } from './io.js';
import vapidRoute from './routes/vapid.js';
import pushRoute from './routes/push.js';
import towerRoute from './routes/tower.js';
import bgfetchRoute from './routes/bgfetch.js';
import passkeysRoute from './routes/passkeys.js';
import { createManifestHandler } from './pwaManifest.js';

webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

const app = express();
// Cloud Run sits behind a proxy, so trust X-Forwarded-* so req.protocol /
// req.hostname report the original client values (used by the canonical-
// host redirect below).
app.set('trust proxy', true);

// Canonical-host redirect: any request to a non-canonical hostname (e.g.
// www.yesweb.app) gets a 301 to the canonical host with path + query
// preserved. CANONICAL_HOST is read from env so prod, staging, and any
// future domain swap can configure it without code changes. If unset, the
// middleware is a no-op — local dev hits localhost which is exempt anyway.
const canonicalHost = process.env.CANONICAL_HOST?.toLowerCase();
// Alternate domains that must be served *directly* (kept in the address bar,
// never redirected to the canonical host). Comma-separated. Used for legacy /
// fallback domains pointed at the same Cloud Run service — e.g. pwa.dipduo.com,
// the original domain, kept alive because some networks' DNS blocklists flag
// the newer yesweb.app. Redirecting those to yesweb.app would defeat the
// fallback, so each listed host is exempt from the 301. The canonical host is
// always served directly; www.* and everything else still fall through to it.
const allowedHosts = new Set(
  (process.env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);
if (canonicalHost) allowedHosts.add(canonicalHost);

if (canonicalHost) {
  app.use((req, res, next) => {
    const host = (req.headers.host ?? '').toLowerCase();
    // Strip an optional :port (Cloud Run won't send one but other proxies might).
    const hostOnly = host.split(':')[0];
    // Allowlisted hosts + localhost / private IPs are served as-is.
    if (
      allowedHosts.has(hostOnly) ||
      hostOnly === 'localhost' ||
      hostOnly.endsWith('.localhost') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostOnly) ||
      hostOnly.endsWith('.run.app')
    ) {
      return next();
    }
    res.redirect(301, `https://${canonicalHost}${req.originalUrl}`);
  });
}

// Dev/demo mode: accept connections from any origin so other devices on
// the LAN (phones, tablets) can hit the API.
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.use('/api/vapid-public-key', vapidRoute);
app.use('/api/push', pushRoute);
app.use('/api/tower', towerRoute);
app.use('/api/bg-fetch-demo', bgfetchRoute);
app.use('/api/passkeys', passkeysRoute);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, '../../web/dist');
const isCompiled = (process.argv[1] ?? '').endsWith('.js');

import('node:fs').then(({ existsSync }) => {
  if (!isCompiled) {
    console.log('[web] dev mode (tsx) — SPA is served by Vite on :5173, not from /dist');
    return;
  }
  if (existsSync(webDist)) {
    // Per-host PWA manifest — MUST precede express.static so the dynamic copy
    // wins over the baked dist/manifest.webmanifest (see pwaManifest.ts).
    app.get('/manifest.webmanifest', createManifestHandler(webDist));
    app.use(express.static(webDist));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
    console.log(`[web] prod mode — serving static SPA from ${webDist}`);
  } else {
    console.log('[web] no built SPA found — run `npm run build` first');
  }
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
attachSocket(io);

server.listen(env.PORT, env.HOST, () => {
  console.log(`[api] listening on http://${env.HOST}:${env.PORT}`);
  if (env.HOST === '0.0.0.0') {
    console.log('[api] reachable from any device on this LAN — find your machine\'s IP');
  }
});
