/** Shared server-side metrics — imported by both io.ts and game/index.ts to avoid circular deps. */
export const serverMetrics = {
  rxEvents: 0,
  rxBytesEst: 0,
  txEvents: 0,
  txBytesEst: 0,
  startedAt: Date.now(),
};
