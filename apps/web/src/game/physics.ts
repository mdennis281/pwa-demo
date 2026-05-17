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

/** Returns the y of the top surface of a box if the player's xz column is over it, else null. */
function topUnder(px: number, pz: number, b: Box): number | null {
  if (px > b.x - b.hx - PLAYER.rxz && px < b.x + b.hx + PLAYER.rxz &&
      pz > b.z - b.hz - PLAYER.rxz && pz < b.z + b.hz + PLAYER.rxz) {
    return b.y + b.hy;
  }
  return null;
}

/**
 * Hand-rolled, AABB-vs-box physics step.
 * Returns the player's new feet position and whether they're grounded.
 */
export function stepPlayer(opts: {
  feetX: number; feetY: number; feetZ: number;
  vx: number; vy: number; vz: number;
  jumpRequested: boolean;
  grounded: boolean;
  dt: number;
  gravity: number;
  jumpSpeed: number;
  boxes: Box[];
}): {
  feetX: number; feetY: number; feetZ: number;
  vx: number; vy: number; vz: number;
  grounded: boolean;
} {
  let { feetX, feetY, feetZ, vx, vy, vz } = opts;
  let grounded = opts.grounded;

  // jump
  if (opts.jumpRequested && grounded) {
    vy = opts.jumpSpeed;
    grounded = false;
  }

  // gravity
  vy -= opts.gravity * opts.dt;

  // ── horizontal sweep ──
  feetX += vx * opts.dt;
  feetZ += vz * opts.dt;

  const headY = feetY + PLAYER.height;

  // Push out of any box we are intersecting horizontally at our current height.
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
  grounded = false;

  // floor
  if (feetY < 0) {
    feetY = 0;
    vy = 0;
    grounded = true;
  }

  // boxes: land on top, bump head from below
  for (const b of opts.boxes) {
    const topY = b.y + b.hy;
    const botY = b.y - b.hy;
    const overlapsXZ =
      Math.abs(feetX - b.x) < b.hx + PLAYER.rxz &&
      Math.abs(feetZ - b.z) < b.hz + PLAYER.rxz;
    if (!overlapsXZ) continue;

    const headYNow = feetY + PLAYER.height;
    if (vy <= 0 && feetY < topY && feetY > topY - 0.6) {
      // landing on top
      feetY = topY;
      vy = 0;
      grounded = true;
    } else if (vy > 0 && headYNow > botY && headYNow < botY + 0.6) {
      // bumping head from below
      feetY = botY - PLAYER.height;
      vy = 0;
    }
  }

  return { feetX, feetY, feetZ, vx, vy, vz, grounded };
}

/** Quick check: is the player standing on any surface? Used as a hint for jump anim. */
export function isGrounded(feetX: number, feetY: number, feetZ: number, boxes: Box[]): boolean {
  if (feetY <= 0.01) return true;
  for (const b of boxes) {
    const topY = b.y + b.hy;
    if (Math.abs(feetY - topY) < 0.05) {
      if (topUnder(feetX, feetZ, b) !== null) return true;
    }
  }
  return false;
}
