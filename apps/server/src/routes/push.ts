import { Router } from 'express';
import webpush, { type PushSubscription } from 'web-push';
import type { PushPayload } from '@pwa-demo/shared';

const router = Router();

const subscriptions = new Map<string, PushSubscription>();

function subKey(sub: PushSubscription): string {
  return sub.endpoint;
}

router.post('/subscribe', (req, res) => {
  const sub = req.body as PushSubscription | undefined;
  if (!sub?.endpoint) {
    res.status(400).json({ error: 'missing subscription' });
    return;
  }
  subscriptions.set(subKey(sub), sub);
  console.log(`[push] subscribed (total=${subscriptions.size}): ${sub.endpoint.slice(0, 60)}...`);
  res.json({ ok: true, count: subscriptions.size });
});

router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body ?? {};
  if (!endpoint) {
    res.status(400).json({ error: 'missing endpoint' });
    return;
  }
  subscriptions.delete(endpoint);
  res.json({ ok: true, count: subscriptions.size });
});

router.post('/test', async (req, res) => {
  const payload: PushPayload = {
    title: req.body?.title ?? 'Hello from PWA Demo',
    body: req.body?.body ?? 'This notification was delivered via Web Push.',
    url: req.body?.url ?? '/push',
  };

  const targets = req.body?.endpoint
    ? [subscriptions.get(req.body.endpoint)].filter(Boolean) as PushSubscription[]
    : Array.from(subscriptions.values());

  if (targets.length === 0) {
    res.status(400).json({ error: 'no subscriptions registered' });
    return;
  }

  const results = await Promise.allSettled(
    targets.map((s) => webpush.sendNotification(s, JSON.stringify(payload))),
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - sent;

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const reason = r.reason as { statusCode?: number } | undefined;
      if (reason?.statusCode === 404 || reason?.statusCode === 410) {
        subscriptions.delete(subKey(targets[i]));
      }
      console.warn('[push] send failed:', r.reason);
    }
  });

  res.json({ ok: true, sent, failed, total: targets.length });
});

router.get('/count', (_req, res) => res.json({ count: subscriptions.size }));

export default router;
