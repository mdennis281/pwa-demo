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

webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

const app = express();
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.use('/api/vapid-public-key', vapidRoute);
app.use('/api/push', pushRoute);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, '../../web/dist');
const isCompiled = (process.argv[1] ?? '').endsWith('.js');

import('node:fs').then(({ existsSync }) => {
  if (!isCompiled) {
    console.log('[web] dev mode (tsx) — SPA is served by Vite on :5173, not from /dist');
    return;
  }
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
    console.log(`[web] prod mode — serving static SPA from ${webDist}`);
  } else {
    console.log('[web] no built SPA found — run `npm run build` first');
  }
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: env.WEB_ORIGIN, credentials: true } });
attachSocket(io);

server.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});
