import { Router } from 'express';
import { env } from '../env.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY });
});

export default router;
