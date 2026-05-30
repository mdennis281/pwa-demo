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

function buildPayload(body: Record<string, unknown> | undefined): PushPayload {
  return {
    title: (body?.title as string | undefined) ?? 'Hello from YesWeb',
    body: (body?.body as string | undefined) ?? 'This notification was delivered via Web Push.',
    url: (body?.url as string | undefined) ?? '/push',
  };
}

/** Send `payload` to `targets` and prune any subs the push service has
 *  declared dead (404/410). Returns {sent, failed, total} for the response. */
async function dispatch(
  targets: PushSubscription[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; total: number }> {
  const results = await Promise.allSettled(
    targets.map((s) => webpush.sendNotification(s, JSON.stringify(payload))),
  );
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const reason = r.reason as { statusCode?: number } | undefined;
      if (reason?.statusCode === 404 || reason?.statusCode === 410) {
        subscriptions.delete(subKey(targets[i]));
      }
      console.warn('[push] send failed:', r.reason);
    }
  });
  return { sent, failed: results.length - sent, total: targets.length };
}

function resolveTargets(endpoint: string | undefined): PushSubscription[] {
  if (endpoint) {
    const one = subscriptions.get(endpoint);
    return one ? [one] : [];
  }
  return Array.from(subscriptions.values());
}

router.post('/test', async (req, res) => {
  const targets = resolveTargets(req.body?.endpoint);
  if (targets.length === 0) {
    res.status(400).json({ error: 'no subscriptions registered' });
    return;
  }
  const result = await dispatch(targets, buildPayload(req.body));
  res.json({ ok: true, ...result });
});

/** Schedule a push for N seconds in the future via a process-local timer.
 *  Returns immediately so the caller can close the tab and still receive
 *  the notification — the whole point of demonstrating Web Push.
 *
 *  Trade-offs vs. a durable queue:
 *    - Server restart drops in-flight timers. Acceptable for a demo box;
 *      a real product would persist to Postgres + recover on boot.
 *    - We snapshot the recipient set AT SCHEDULE TIME, so a user who
 *      unsubscribes mid-countdown still gets the test fired (matches what
 *      the user expects when they click "send in 10s"). */
router.post('/test/delayed', (req, res) => {
  const raw = Number(req.body?.delaySeconds);
  const delaySeconds = Number.isFinite(raw) ? Math.max(1, Math.min(60, Math.floor(raw))) : 5;
  const targets = resolveTargets(req.body?.endpoint);
  if (targets.length === 0) {
    res.status(400).json({ error: 'no subscriptions registered' });
    return;
  }
  const payload = buildPayload(req.body);
  const firesAt = Date.now() + delaySeconds * 1000;
  setTimeout(() => {
    void dispatch(targets, payload).then((r) => {
      console.log(`[push] delayed send fired: sent=${r.sent} failed=${r.failed} total=${r.total}`);
    });
  }, delaySeconds * 1000);
  // 202 Accepted is the right semantic: we've enqueued, not delivered.
  res.status(202).json({ ok: true, scheduled: true, delaySeconds, firesAt, total: targets.length });
});

router.get('/count', (_req, res) => res.json({ count: subscriptions.size }));

export default router;
