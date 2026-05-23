import { Router } from 'express';
import { topTowerHighScores } from '../db/towerScores.js';

const router = Router();

/** GET /api/tower/leaderboard?limit=10
 *  Returns the persistent cross-session leaderboard for the Official Server.
 *  Limit is clamped to [1, 50] so a curious client can't ask for unbounded
 *  rows. Cached via Cache-Control for 5 seconds to absorb refresh storms. */
router.get('/leaderboard', async (req, res) => {
  const raw = Number(req.query.limit ?? 10);
  const limit = Number.isFinite(raw) ? Math.max(1, Math.min(50, Math.floor(raw))) : 10;
  const top = await topTowerHighScores(limit);
  res.setHeader('Cache-Control', 'public, max-age=5');
  res.json({ leaderboard: top });
});

export default router;
