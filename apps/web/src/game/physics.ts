export type Box = {
  /** center */
  x: number;
  y: number;
  z: number;
  /** half extents */
  hx: number;
  hy: number;
  hz: number;
};

export const PLAYER = {
  /** half-width on x/z */
  rxz: 0.4,
  /** total height */
  height: 1.6,
  /** y offset from feet to body center */
  cy: 0.8,
};

/**
 * Hand-rolled AABB physics step. Caller already set vy for any jump impulse.
 * Returns new feet position, velocity, and whether the player ended up grounded.
 */
export function stepPlayer(opts: {
  feetX: number; feetY: number; feetZ: number;
  vx: number; vy: number; vz: number;
  dt: number;
  gravity: number;
  boxes: Box[];
}): {
  feetX: number; feetY: number; feetZ: number;
  vx: number; vy: number; vz: number;
  grounded: boolean;
} {
  let { feetX, feetY, feetZ, vx, vy, vz } = opts;

  // gravity
  vy -= opts.gravity * opts.dt;

  // ── horizontal sweep ──
  feetX += vx * opts.dt;
  feetZ += vz * opts.dt;

  const headY = feetY + PLAYER.height;
  for (const b of opts.boxes) {
    const overlapsY = headY > b.y - b.hy && feetY < b.y + b.hy;
    if (!overlapsY) continue;
    const dx = feetX - b.x;
    const dz = feetZ - b.z;
    const px = b.hx + PLAYER.rxz - Math.abs(dx);
    const pz = b.hz + PLAYER.rxz - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) {
        feetX += dx >= 0 ? px : -px;
        vx = 0;
      } else {
        feetZ += dz >= 0 ? pz : -pz;
        vz = 0;
      }
    }
  }

  // ── vertical sweep ──
  feetY += vy * opts.dt;
  let grounded = false;

  if (feetY < 0) {
    feetY = 0;
    vy = 0;
    grounded = true;
  }

  for (const b of opts.boxes) {
    const topY = b.y + b.hy;
    const botY = b.y - b.hy;
    const overlapsXZ =
      Math.abs(feetX - b.x) < b.hx + PLAYER.rxz &&
      Math.abs(feetZ - b.z) < b.hz + PLAYER.rxz;
    if (!overlapsXZ) continue;

    const headYNow = feetY + PLAYER.height;
    if (vy <= 0 && feetY < topY && feetY > topY - 0.7) {
      feetY = topY;
      vy = 0;
      grounded = true;
    } else if (vy > 0 && headYNow > botY && headYNow < botY + 0.6) {
      feetY = botY - PLAYER.height;
      vy = 0;
    }
  }

  return { feetX, feetY, feetZ, vx, vy, vz, grounded };
}
