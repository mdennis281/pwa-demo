import type { Box } from './physics';

// ────────────────────── types ──────────────────────

export type MeshDesc =
  | { type: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; color: string; rotY?: number; cast?: boolean; receive?: boolean; emissive?: string; emissiveIntensity?: number; roughness?: number }
  | { type: 'cone'; x: number; y: number; z: number; radius: number; height: number; color: string; rotY?: number; segments?: number; cast?: boolean }
  | { type: 'cylinder'; x: number; y: number; z: number; radius: number; height: number; color: string; rotY?: number; segments?: number; cast?: boolean; emissive?: string; emissiveIntensity?: number }
  | { type: 'sphere'; x: number; y: number; z: number; radius: number; color: string; cast?: boolean; emissive?: string; emissiveIntensity?: number; segments?: number };

export type Windmill = { x: number; y: number; z: number; rotY: number };
export type Flag = { x: number; y: number; z: number; rotY: number; color: string };
export type SmokePuff = { x: number; y: number; z: number };

export type Mover = {
  /** current position written each frame from definition */
  x: number; y: number; z: number;
  hx: number; hy: number; hz: number;
  color: string;
  /** Endpoints A→B; mover oscillates linearly with sine ease */
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  /** period in seconds */
  period: number;
  /** phase offset 0..1 */
  phase: number;
  /** previous-frame position, used by Player to carry mounted riders */
  prevX: number; prevY: number; prevZ: number;
};

export type WorldData = {
  boxes: Box[];
  /** gravity-suppressing climb volumes (true ladders) */
  ladders: Box[];
  /** time-synchronized moving platforms */
  movers: Mover[];
  meshes: MeshDesc[];
  windmills: Windmill[];
  flags: Flag[];
  smoke: SmokePuff[];
  goal: { x: number; y: number; z: number };
  maxHeight: number;
};

// ────────────────────── palette ──────────────────────

const C = {
  grass: '#9be37c',
  grassDeep: '#65d249',
  grassDark: '#3a9b2c',
  dirt: '#b07a3a',
  dirtDark: '#704a1f',
  cobble: '#aab3bc',
  cobbleEdge: '#5e6a76',
  cobbleDark: '#7a8590',
  wood: '#7a4b1e',
  woodLight: '#a06b34',
  woodDark: '#522e10',
  plank: '#8a5526',

  wallCream: '#fff1d0',
  wallMint: '#b9f0d4',
  wallPink: '#ffc8e1',
  wallSky: '#bee0ff',
  wallLav: '#dcc8ff',
  wallPeach: '#ffd4b3',
  wallOlive: '#d6e0a3',

  roofRed: '#d8451f',
  roofTeal: '#0f9a8d',
  roofCoral: '#ee7e3d',
  roofLav: '#7b3fd6',
  roofPlum: '#a233a8',
  roofGold: '#d99826',
  roofBlue: '#1e63d4',
  roofForest: '#1b7a3a',

  treeTrunk: '#5d3a17',
  treeTrunkLight: '#8b5a2b',
  treeFol: '#22a045',
  treeFol2: '#3fc262',
  treeFolDark: '#157032',
  treeBlossom: '#ffc0cb',

  lanternGlow: '#ffd97a',
  lanternBody: '#7b2a0d',

  mushCap: '#dc2626',
  mushCapPurple: '#9333ea',
  mushCapBlue: '#3b82f6',
  mushStem: '#fff6e0',

  cloud: '#f8fafc',
  cloudEdge: '#e2e8f0',

  crystalA: '#9a7af3',
  crystalB: '#c4b5fd',
  crystalC: '#7dd3fc',
  crystalD: '#fbcfe8',

  doorBrown: '#5e2d10',
  windowGlow: '#ffe49a',
  windowFrame: '#5e2d10',

  flag1: '#ef4444',
  flag2: '#2563eb',
  flag3: '#f59e0b',
  flag4: '#10b981',
  flag5: '#a855f7',

  smoke: '#cbd5e1',

  metal: '#475569',
  metalLight: '#9aa3ad',

  water: '#3aa9d6',
  haystack: '#f5d062',
  cabbage: '#76c25b',
  pumpkin: '#e08530',
  rope: '#a87a3a',

  fenceWood: '#8a5526',
};

// ────────────────────── rng ──────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ────────────────────── primitives ──────────────────────

function solidBox(out: WorldData, x: number, y: number, z: number, hx: number, hy: number, hz: number, color: string, opts: { rotY?: number; rough?: number; cast?: boolean; receive?: boolean } = {}) {
  out.boxes.push({ x, y, z, hx, hy, hz });
  out.meshes.push({ type: 'box', x, y, z, hx, hy, hz, color, rotY: opts.rotY, roughness: opts.rough, cast: opts.cast, receive: opts.receive });
}

function decoBox(out: WorldData, x: number, y: number, z: number, hx: number, hy: number, hz: number, color: string, opts: { rotY?: number; emissive?: string; emissiveIntensity?: number; rough?: number; cast?: boolean } = {}) {
  out.meshes.push({ type: 'box', x, y, z, hx, hy, hz, color, rotY: opts.rotY, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity, roughness: opts.rough, cast: opts.cast });
}

function decoCone(out: WorldData, x: number, y: number, z: number, radius: number, height: number, color: string, opts: { rotY?: number; segments?: number; cast?: boolean } = {}) {
  out.meshes.push({ type: 'cone', x, y, z, radius, height, color, rotY: opts.rotY, segments: opts.segments, cast: opts.cast });
}

function decoCyl(out: WorldData, x: number, y: number, z: number, radius: number, height: number, color: string, opts: { rotY?: number; segments?: number; cast?: boolean; emissive?: string; emissiveIntensity?: number } = {}) {
  out.meshes.push({ type: 'cylinder', x, y, z, radius, height, color, rotY: opts.rotY, segments: opts.segments, cast: opts.cast, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity });
}

function decoSphere(out: WorldData, x: number, y: number, z: number, radius: number, color: string, opts: { cast?: boolean; emissive?: string; emissiveIntensity?: number; segments?: number } = {}) {
  out.meshes.push({ type: 'sphere', x, y, z, radius, color, cast: opts.cast, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity, segments: opts.segments });
}

/** Create a TRUE LADDER: gravity-free volume the player climbs by holding W,
 *  plus decorative wood frame and rungs. Volume spans baseY → topY along the
 *  vertical axis. CRUCIAL: the volume extends EXTRA above topY so the player
 *  exits ABOVE the destination platform and falls cleanly onto it (rather
 *  than being shoved sideways during the climb-through-platform phase). */
const LADDER_OVERSHOOT = 1.2;

function ladderVolume(out: WorldData, opts: {
  cx: number; cz: number;
  /** y of the bottom of the ladder */
  baseY: number;
  /** y of the destination platform top — the volume extends LADDER_OVERSHOOT above this */
  topY: number;
  /** orientation — face the ladder away from this normal direction. Player
   *  approaches from +normal. Volume is thin along normal, wide perpendicular. */
  faceX: number; faceZ: number;
  width?: number;
}) {
  const w = (opts.width ?? 0.9) / 2;
  const perp: [number, number] = [-opts.faceZ, opts.faceX];
  const volTopY = opts.topY + LADDER_OVERSHOOT;
  const cy = (opts.baseY + volTopY) / 2;
  const hy = (volTopY - opts.baseY) / 2;
  const halfThickness = 0.35;
  const hxVol = Math.abs(opts.faceX) > 0.5 ? halfThickness : w;
  const hzVol = Math.abs(opts.faceZ) > 0.5 ? halfThickness : w;
  out.ladders.push({ x: opts.cx, y: cy, z: opts.cz, hx: hxVol, hy, hz: hzVol });

  // Two vertical wood posts (visual only)
  for (const sign of [1, -1] as const) {
    const px = opts.cx + perp[0] * w * sign;
    const pz = opts.cz + perp[1] * w * sign;
    decoCyl(out, px, (opts.baseY + opts.topY) / 2, pz, 0.06, opts.topY - opts.baseY + 0.2, C.wood);
  }
  // Rungs every 0.5m up to (but not past) opts.topY — purely visual
  const rungSpacing = 0.5;
  const nRungs = Math.max(2, Math.floor((opts.topY - opts.baseY) / rungSpacing));
  for (let i = 1; i <= nRungs; i++) {
    const y = opts.baseY + i * rungSpacing;
    const rotY = Math.atan2(opts.faceZ, opts.faceX) + Math.PI / 2;
    decoBox(out, opts.cx, y, opts.cz, w - 0.05, 0.04, 0.03, C.woodLight, { rotY });
  }
  // Faint emissive "climb here" hint along the front
  decoBox(out, opts.cx + opts.faceX * 0.36, (opts.baseY + opts.topY) / 2, opts.cz + opts.faceZ * 0.36, hxVol * 0.6, (opts.topY - opts.baseY) / 2, hzVol * 0.6, '#000000', { emissive: '#fbbf24', emissiveIntensity: 0.05, cast: false });
}

/** Spawn a moving platform between two world-space endpoints. */
function mover(out: WorldData, opts: {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  hx: number; hy: number; hz: number;
  period: number;
  phase?: number;
  color?: string;
}) {
  out.movers.push({
    x: opts.ax, y: opts.ay, z: opts.az,
    hx: opts.hx, hy: opts.hy, hz: opts.hz,
    color: opts.color ?? C.wood,
    ax: opts.ax, ay: opts.ay, az: opts.az,
    bx: opts.bx, by: opts.by, bz: opts.bz,
    period: opts.period,
    phase: opts.phase ?? 0,
    prevX: opts.ax, prevY: opts.ay, prevZ: opts.az,
  });
}

// ────────────────────── features: buildings ──────────────────────

type CottageOpts = {
  cx: number; cz: number; baseY: number;
  wallW: number; wallD: number; wallH: number;
  roofH: number;
  wallColor: string; roofColor: string;
  doorFace: 'north' | 'south' | 'east' | 'west';
  windowFaces?: Array<'north' | 'south' | 'east' | 'west'>;
  /** garden patch in front of door (visual) */
  hasGarden?: boolean;
};

function faceVec(face: 'north' | 'south' | 'east' | 'west'): [number, number] {
  switch (face) {
    case 'north': return [0, -1];
    case 'south': return [0, 1];
    case 'east':  return [1, 0];
    case 'west':  return [-1, 0];
  }
}

/** A cottage with a FLAT WALKABLE ROOF and a small decorative pyramid cap.
 *  - Walls: 2.5m tall (one comfortable single jump from ground)
 *  - Roof: flat box, slightly wider than walls, walkable
 *  - Roof cap: small flatter pyramid in the center, NO collider so it doesn't
 *    push you off the roof when you walk near it
 *  Designed so you can hop up onto any cottage. */
function cottage(out: WorldData, opts: CottageOpts) {
  const { cx, cz, baseY, wallW, wallD, wallH, roofH, wallColor, roofColor } = opts;
  const wallCY = baseY + wallH / 2;
  const wallTop = baseY + wallH;

  // Walls
  solidBox(out, cx, wallCY, cz, wallW / 2, wallH / 2, wallD / 2, wallColor, { rough: 0.9 });

  // Flat roof platform — walkable. Slightly wider than walls (overhang).
  const roofPlatHy = 0.08;
  const roofPlatHx = wallW / 2 + 0.25;
  const roofPlatHz = wallD / 2 + 0.25;
  const roofTopY = wallTop + roofPlatHy * 2;        // top surface of the roof
  solidBox(out, cx, wallTop + roofPlatHy, cz, roofPlatHx, roofPlatHy, roofPlatHz, C.woodLight, { rough: 0.9 });

  // Decorative trim around the roof edge
  decoBox(out, cx, roofTopY + 0.04, cz, roofPlatHx + 0.05, 0.04, roofPlatHz + 0.05, C.woodDark, { cast: false });

  // Small flatter pyramid cap in the center — decorative, no collider so the
  // player can walk all the way around it on the roof.
  const capR = Math.min(wallW, wallD) / 2 - 0.3;     // smaller than the roof
  const capH = roofH;                                  // flatter than before (was 1.5+, now ~1.0)
  decoCone(out, cx, roofTopY + capH / 2, cz, capR * Math.SQRT2, capH, roofColor, { rotY: Math.PI / 4, segments: 4 });

  // Chimney + animated smoke puff (on the flat roof, off to one side)
  const chX = cx + wallW / 4;
  const chZ = cz - wallD / 4;
  const chY = roofTopY + 0.5;
  decoBox(out, chX, chY, chZ, 0.22, 0.5, 0.22, '#7f1d1d');
  decoBox(out, chX, chY + 0.52, chZ, 0.27, 0.05, 0.27, '#451a03');
  out.smoke.push({ x: chX, y: chY + 1.0, z: chZ });

  // Door
  const [dnx, dnz] = faceVec(opts.doorFace);
  const onZFace = Math.abs(dnz) > 0;
  const dx = onZFace ? 0 : dnx * (wallW / 2 + 0.01);
  const dz = onZFace ? dnz * (wallD / 2 + 0.01) : 0;
  decoBox(out, cx + dx, baseY + 0.7, cz + dz, onZFace ? 0.35 : 0.04, 0.7, onZFace ? 0.04 : 0.35, C.doorBrown);
  decoBox(out, cx + dx * 1.05, baseY + 0.65, cz + dz * 1.05, onZFace ? 0.05 : 0.02, 0.05, onZFace ? 0.02 : 0.05, '#fbbf24');
  // door frame
  decoBox(out, cx + dx, baseY + 0.7, cz + dz, onZFace ? 0.42 : 0.05, 0.78, onZFace ? 0.05 : 0.42, C.windowFrame);

  // Windows on chosen faces (default: opposite of door)
  const windowFaces = opts.windowFaces ?? (() => {
    if (opts.doorFace === 'north' || opts.doorFace === 'south') return ['east', 'west'] as Array<'north' | 'south' | 'east' | 'west'>;
    return ['north', 'south'] as Array<'north' | 'south' | 'east' | 'west'>;
  })();
  for (const wf of windowFaces) {
    const [wnx, wnz] = faceVec(wf);
    const onZF = Math.abs(wnz) > 0;
    const wx = onZF ? 0 : wnx * (wallW / 2 + 0.01);
    const wz = onZF ? wnz * (wallD / 2 + 0.01) : 0;
    decoBox(out, cx + wx, baseY + wallH * 0.62, cz + wz, onZF ? 0.42 : 0.05, 0.42, onZF ? 0.05 : 0.42, C.windowFrame);
    decoBox(out, cx + wx * 1.01, baseY + wallH * 0.62, cz + wz * 1.01, onZF ? 0.32 : 0.03, 0.32, onZF ? 0.03 : 0.32, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.65 });
  }

  // Small porch + step in front of the door (decorative)
  const px = cx + dnx * (wallW / 2 + 0.7);
  const pz = cz + dnz * (wallD / 2 + 0.7);
  decoBox(out, px, baseY + 0.07, pz, onZFace ? 0.7 : 0.4, 0.07, onZFace ? 0.4 : 0.7, C.cobble);
  decoBox(out, px, baseY + 0.18, pz, onZFace ? 0.55 : 0.3, 0.06, onZFace ? 0.3 : 0.55, C.cobbleEdge);

  // Garden patch
  if (opts.hasGarden) {
    const gx = cx + dnx * (wallW / 2 + 1.6);
    const gz = cz + dnz * (wallD / 2 + 1.6);
    decoBox(out, gx, 0.06, gz, 0.8, 0.05, 0.8, C.dirtDark);
    decoSphere(out, gx - 0.3, 0.18, gz + 0.2, 0.18, C.cabbage);
    decoSphere(out, gx + 0.3, 0.16, gz - 0.1, 0.16, C.cabbage);
    decoSphere(out, gx + 0.1, 0.2, gz + 0.3, 0.2, C.pumpkin);
    decoSphere(out, gx - 0.2, 0.18, gz - 0.3, 0.18, C.cabbage);
  }
}

/** A flight of stairs ascending from (startX, startZ) along (dirX, dirZ). */
function stairFlight(out: WorldData, opts: {
  startX: number; startZ: number;
  dirX: number; dirZ: number;
  steps: number; stepRise: number; stepRun: number;
  width: number;
  color: string; railColor?: string;
}) {
  for (let i = 0; i < opts.steps; i++) {
    const cx = opts.startX + opts.dirX * (i + 0.5) * opts.stepRun;
    const cz = opts.startZ + opts.dirZ * (i + 0.5) * opts.stepRun;
    const topY = (i + 1) * opts.stepRise;
    const hy = topY / 2;
    const cy = topY - hy;
    const hxStep = Math.abs(opts.dirX) > 0.5 ? opts.stepRun / 2 : opts.width / 2;
    const hzStep = Math.abs(opts.dirZ) > 0.5 ? opts.stepRun / 2 : opts.width / 2;
    solidBox(out, cx, cy, cz, hxStep, hy, hzStep, opts.color, { rough: 0.85 });
    if (opts.railColor && i % 2 === 0) {
      const perp: [number, number] = [-opts.dirZ, opts.dirX];
      decoCyl(out, cx + perp[0] * (opts.width / 2 + 0.04), topY + 0.3, cz + perp[1] * (opts.width / 2 + 0.04), 0.04, 0.6, opts.railColor);
      decoCyl(out, cx - perp[0] * (opts.width / 2 + 0.04), topY + 0.3, cz - perp[1] * (opts.width / 2 + 0.04), 0.04, 0.6, opts.railColor);
    }
  }
}

// (the old rung-stack `ladder()` helper has been replaced by `ladderVolume` above)

// ────────────────────── features: trees ──────────────────────

function tree(out: WorldData, opts: { x: number; z: number; height: number; trunk?: string; foliage?: string; }) {
  const trunkR = 0.32 + (opts.height / 6) * 0.1;
  const trunkH = opts.height;
  const trunkC = opts.trunk ?? C.treeTrunk;
  const folC = opts.foliage ?? C.treeFol;
  decoCyl(out, opts.x, trunkH / 2, opts.z, trunkR, trunkH, trunkC, { segments: 10 });
  out.boxes.push({ x: opts.x, y: trunkH / 2, z: opts.z, hx: trunkR * 0.85, hy: trunkH / 2, hz: trunkR * 0.85 });
  const folBase = trunkH - 0.2;
  decoSphere(out, opts.x, folBase + 0.6, opts.z, 1.3, folC);
  decoSphere(out, opts.x - 0.7, folBase + 0.4, opts.z + 0.3, 1.0, folC === C.treeFol ? C.treeFol2 : folC);
  decoSphere(out, opts.x + 0.6, folBase + 0.5, opts.z - 0.4, 1.0, folC === C.treeFol ? C.treeFol2 : folC);
  decoSphere(out, opts.x + 0.1, folBase + 1.4, opts.z + 0.1, 0.9, folC);
}

function blossomTree(out: WorldData, x: number, z: number, height: number) {
  const trunkR = 0.3;
  decoCyl(out, x, height / 2, z, trunkR, height, C.treeTrunkLight, { segments: 10 });
  out.boxes.push({ x, y: height / 2, z, hx: trunkR * 0.85, hy: height / 2, hz: trunkR * 0.85 });
  decoSphere(out, x, height + 0.4, z, 1.1, C.treeBlossom);
  decoSphere(out, x - 0.6, height + 0.2, z + 0.3, 0.85, C.treeBlossom);
  decoSphere(out, x + 0.5, height + 0.3, z - 0.4, 0.9, C.treeBlossom);
  decoSphere(out, x + 0.1, height + 1.1, z + 0.1, 0.7, '#ffe1ec');
}

function pineTree(out: WorldData, x: number, z: number, height: number) {
  const trunkR = 0.28;
  decoCyl(out, x, height / 2, z, trunkR, height, C.treeTrunk, { segments: 10 });
  out.boxes.push({ x, y: height / 2, z, hx: trunkR * 0.85, hy: height / 2, hz: trunkR * 0.85 });
  // Stacked cones
  for (let i = 0; i < 4; i++) {
    const ry = height + 0.2 + i * 0.7;
    const rad = 1.4 - i * 0.25;
    decoCone(out, x, ry, z, rad, 1.0, C.treeFolDark, { segments: 10 });
  }
}

/** Climbing tree — collidable branch platforms zigzag up to topY. */
function climbingTree(out: WorldData, cx: number, cz: number, topY: number) {
  const trunkR = 0.5;
  const trunkH = topY + 0.5;
  decoCyl(out, cx, trunkH / 2, cz, trunkR, trunkH, C.treeTrunk, { segments: 12 });
  out.boxes.push({ x: cx, y: trunkH / 2, z: cz, hx: trunkR * 0.85, hy: trunkH / 2, hz: trunkR * 0.85 });
  const layout: [number, number, number][] = [
    [1.4, 1.5,  0.0],
    [-1.4, 3.0, 0.6],
    [0.5, 4.4, -1.5],
    [-0.6, 5.8, 1.4],
    [1.5, 7.0, 0.2],
    [-0.2, topY, -0.2],
  ];
  for (const [dx, by, dz] of layout) {
    if (by > trunkH) break;
    solidBox(out, cx + dx, by, cz + dz, 0.6, 0.12, 0.6, C.treeTrunk, { rough: 0.9 });
    decoSphere(out, cx + dx * 1.4, by + 0.4, cz + dz * 1.4, 0.6, C.treeFol);
    decoSphere(out, cx + dx * 1.4, by + 0.6, cz + dz * 1.4 - 0.3, 0.45, C.treeFol2);
  }
  decoSphere(out, cx,        topY + 0.9, cz,        1.5, C.treeFol);
  decoSphere(out, cx - 0.9,  topY + 0.7, cz + 0.4,  1.1, C.treeFol2);
  decoSphere(out, cx + 0.8,  topY + 0.8, cz - 0.5,  1.1, C.treeFol2);
  decoSphere(out, cx + 0.2,  topY + 1.6, cz + 0.1,  0.9, C.treeFol);
}

// ────────────────────── features: small props ──────────────────────

function lantern(out: WorldData, x: number, baseY: number, z: number, height = 2.2) {
  decoCyl(out, x, baseY + height / 2, z, 0.05, height, C.metal);
  decoSphere(out, x, baseY + height + 0.15, z, 0.2, C.lanternGlow, { emissive: C.lanternGlow, emissiveIntensity: 1.6 });
  decoBox(out, x, baseY + height + 0.35, z, 0.08, 0.08, 0.08, C.lanternBody);
}

function mushroom(out: WorldData, x: number, z: number, scale = 1, color: 'red' | 'purple' | 'blue' = 'red') {
  const stemH = 0.4 * scale;
  decoCyl(out, x, stemH / 2, z, 0.12 * scale, stemH, C.mushStem);
  const cap = color === 'purple' ? C.mushCapPurple : color === 'blue' ? C.mushCapBlue : C.mushCap;
  decoSphere(out, x, stemH + 0.18 * scale, z, 0.32 * scale, cap);
  decoSphere(out, x - 0.1 * scale, stemH + 0.3 * scale, z + 0.05 * scale, 0.05 * scale, '#fef9c3');
  decoSphere(out, x + 0.1 * scale, stemH + 0.25 * scale, z - 0.07 * scale, 0.05 * scale, '#fef9c3');
}

function flowerPatch(out: WorldData, x: number, z: number, count: number, rng: () => number) {
  for (let i = 0; i < count; i++) {
    const fx = x + (rng() * 2 - 1) * 0.6;
    const fz = z + (rng() * 2 - 1) * 0.6;
    const h = 0.15 + rng() * 0.12;
    decoCyl(out, fx, h / 2, fz, 0.02, h, '#4ade80');
    const color = ['#f43f5e', '#facc15', '#a855f7', '#38bdf8', '#fb923c'][Math.floor(rng() * 5)];
    decoSphere(out, fx, h + 0.07, fz, 0.08, color);
  }
}

function barrel(out: WorldData, x: number, z: number, scale = 1) {
  const r = 0.32 * scale;
  const h = 0.7 * scale;
  decoCyl(out, x, h / 2, z, r, h, C.wood, { segments: 14 });
  out.boxes.push({ x, y: h / 2, z, hx: r * 0.85, hy: h / 2, hz: r * 0.85 });
  // bands
  decoCyl(out, x, h * 0.2, z, r * 1.03, 0.05, '#1f1308', { segments: 14 });
  decoCyl(out, x, h * 0.8, z, r * 1.03, 0.05, '#1f1308', { segments: 14 });
}

function haystack(out: WorldData, x: number, z: number, scale = 1) {
  const r = 0.55 * scale;
  const h = 0.55 * scale;
  decoCyl(out, x, h / 2, z, r, h, C.haystack, { segments: 14 });
  decoCyl(out, x, h / 2, z, r * 1.01, 0.06, '#caa845', { segments: 14 });
  out.boxes.push({ x, y: h / 2, z, hx: r * 0.85, hy: h / 2, hz: r * 0.85 });
  // strands on top
  decoSphere(out, x, h + 0.05, z, r * 0.7, C.haystack);
}

function bench(out: WorldData, x: number, z: number, rotY = 0) {
  // seat
  const seatY = 0.4;
  solidBox(out, x, seatY, z, 0.7, 0.05, 0.25, C.wood, { rotY, rough: 0.9 });
  // legs (visual)
  const ox = Math.cos(rotY) * 0.6;
  const oz = -Math.sin(rotY) * 0.6;
  const ox2 = Math.sin(rotY) * 0.2;
  const oz2 = Math.cos(rotY) * 0.2;
  for (const sx of [1, -1] as const) {
    decoBox(out, x + sx * ox + ox2, 0.2, z + sx * oz + oz2, 0.05, 0.2, 0.05, C.woodDark, { rotY });
    decoBox(out, x + sx * ox - ox2, 0.2, z + sx * oz - oz2, 0.05, 0.2, 0.05, C.woodDark, { rotY });
  }
  // backrest (visual)
  const bx = Math.sin(rotY) * 0.25;
  const bz = Math.cos(rotY) * 0.25;
  decoBox(out, x - bx, seatY + 0.35, z - bz, 0.7, 0.35, 0.04, C.woodLight, { rotY });
}

function sign(out: WorldData, x: number, z: number, rotY = 0, color = C.wood) {
  // post
  decoCyl(out, x, 0.5, z, 0.06, 1, C.woodDark);
  // board
  const bx = Math.cos(rotY) * 0.3;
  const bz = -Math.sin(rotY) * 0.3;
  decoBox(out, x + bx, 0.85, z + bz, 0.4, 0.25, 0.04, color, { rotY });
}

function fenceSegment(out: WorldData, x1: number, z1: number, x2: number, z2: number) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return;
  const rotY = Math.atan2(dx, dz);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  // two horizontal rails
  decoBox(out, cx, 0.7, cz, 0.04, 0.05, len / 2, C.fenceWood, { rotY });
  decoBox(out, cx, 0.3, cz, 0.04, 0.05, len / 2, C.fenceWood, { rotY });
  // a few vertical posts
  const numPosts = Math.max(2, Math.ceil(len / 1.2));
  for (let i = 0; i <= numPosts; i++) {
    const t = i / numPosts;
    decoCyl(out, x1 + dx * t, 0.5, z1 + dz * t, 0.05, 1.0, C.fenceWood);
  }
}

function well(out: WorldData, cx: number, cz: number, baseY = 0) {
  // stone rim
  const rimR = 0.9;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const sx = cx + Math.cos(a) * rimR;
    const sz = cz + Math.sin(a) * rimR;
    decoBox(out, sx, baseY + 0.4, sz, 0.18, 0.4, 0.18, C.cobble, { rotY: a });
  }
  out.boxes.push({ x: cx, y: baseY + 0.4, z: cz, hx: rimR * 0.75, hy: 0.4, hz: rimR * 0.75 });
  // dark water disc
  decoCyl(out, cx, baseY + 0.6, cz, rimR * 0.7, 0.04, C.water, { segments: 18, emissive: '#1e3a8a', emissiveIntensity: 0.15 });
  // roof posts
  for (const [sx, sz] of [[-rimR * 0.8, -rimR * 0.8], [rimR * 0.8, -rimR * 0.8], [-rimR * 0.8, rimR * 0.8], [rimR * 0.8, rimR * 0.8]] as const) {
    decoCyl(out, cx + sx, baseY + 1.6, cz + sz, 0.07, 2.0, C.wood);
  }
  // flatter pyramid roof (was 0.9 tall, now 0.55)
  decoCone(out, cx, baseY + 2.85, cz, rimR * 1.4, 0.55, C.roofRed, { rotY: Math.PI / 4, segments: 4 });
  // crank handle (decorative)
  decoCyl(out, cx, baseY + 2.4, cz, 0.05, 1.8, C.wood, { rotY: Math.PI / 2 });
  decoSphere(out, cx + 0.9, baseY + 2.4, cz, 0.1, C.wood);
}

function pathTile(out: WorldData, x: number, z: number, shade = 1.0) {
  decoBox(out, x, 0.02, z, 0.5, 0.02, 0.5, shadeColor(C.cobble, shade), { cast: false });
}

// ────────────────────── features: bridges, platforms ──────────────────────

function bridge(out: WorldData, x1: number, z1: number, x2: number, z2: number, y: number) {
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return;
  const rotY = Math.atan2(dx, dz);
  const halfW = 0.7;
  const halfTH = 0.1;

  // Visual: single rotated plank
  decoBox(out, cx, y, cz, halfW, halfTH, len / 2, C.plank, { rotY, rough: 0.85 });

  // Physics: chain of short axis-aligned AABB segments (AABB can't rotate)
  const dirX = dx / len;
  const dirZ = dz / len;
  const segMax = 0.6;
  const numSegs = Math.max(1, Math.ceil(len / segMax));
  const segLen = len / numSegs;
  for (let i = 0; i < numSegs; i++) {
    const t = (i + 0.5) / numSegs;
    const sx = x1 + dx * t;
    const sz = z1 + dz * t;
    const hxSeg = Math.abs(dirX) * (segLen / 2) + Math.abs(dirZ) * halfW;
    const hzSeg = Math.abs(dirZ) * (segLen / 2) + Math.abs(dirX) * halfW;
    out.boxes.push({ x: sx, y, z: sz, hx: hxSeg, hy: halfTH, hz: hzSeg });
  }

  // Rope rails (visual)
  for (const sign of [1, -1] as const) {
    const ox = -Math.cos(rotY) * 0.75 * sign;
    const oz = Math.sin(rotY) * 0.75 * sign;
    decoBox(out, cx + ox, y + 0.5, cz + oz, 0.03, 0.5, len / 2, C.rope, { rotY });
  }
  for (const [ex, ez] of [[x1, z1], [x2, z2]] as const) {
    decoCyl(out, ex, y + 0.4, ez, 0.08, 0.8, C.wood);
  }
}

function platform(out: WorldData, x: number, y: number, z: number, hx: number, hz: number, color = C.grassDeep, top = C.grass) {
  const hy = 0.3;
  solidBox(out, x, y - hy, z, hx, hy, hz, color, { rough: 0.9 });
  decoBox(out, x, y + 0.02, z, hx * 0.98, 0.04, hz * 0.98, top, { rough: 0.9, cast: false });
}

function cloudPlatform(out: WorldData, x: number, y: number, z: number, r: number) {
  solidBox(out, x, y - 0.15, z, r, 0.15, r * 0.7, C.cloud, { rough: 1 });
  decoSphere(out, x - r * 0.4, y, z, r * 0.55, C.cloud);
  decoSphere(out, x + r * 0.45, y, z + r * 0.1, r * 0.6, C.cloud);
  decoSphere(out, x + r * 0.05, y, z - r * 0.4, r * 0.5, C.cloud);
  decoSphere(out, x - r * 0.2, y + 0.05, z + r * 0.3, r * 0.4, C.cloudEdge);
}

function crystal(out: WorldData, x: number, baseY: number, z: number, height: number) {
  const choices = [C.crystalA, C.crystalB, C.crystalC, C.crystalD];
  const c = choices[Math.floor(Math.abs((x * 7 + z * 13))) % choices.length];
  decoCone(out, x, baseY + height / 2, z, 0.9, height, c, { segments: 6 });
  decoCone(out, x, baseY + height / 2 + 0.4, z, 0.55, height * 0.4, C.crystalB, { segments: 6 });
  // Larger landable cap (1.6m square) so a slightly off-target jump still lands
  solidBox(out, x, baseY + height + 0.06, z, 0.8, 0.06, 0.8, C.crystalC, { rough: 0.3 });
}

// ────────────────────── features: climbable structures ──────────────────────

/** Central spiral staircase tower. Climb route #1. */
/** Central spiral staircase tower. Hand-tuned so the top step's TOP y exactly
 *  equals the top platform's TOP y, and the spiral radius is OUTSIDE the
 *  platform's horizontal footprint — so the walk-on transition has neither
 *  vertical head-bump nor horizontal push-out.
 *
 *  Climb route #1 (the spine).
 *  Gap math (per step): 0.42m vertical, 2.5m angular horizontal — trivial.
 */
function spiralTower(out: WorldData, cx: number, cz: number, baseY: number, topY: number) {
  const tR = 1.8;                       // tower body radius
  const platformHx = 2.8;               // top platform half-extent
  const stepRadius = platformHx + 0.9;  // 3.7 — well outside platformHx + rxz(0.4) = 3.2
  const steps = 22;
  const totalH = topY - baseY;          // 9.4 if baseY=0, topY=9.4
  const stepRise = totalH / steps;      // ≈ 0.427

  // Tower body cylinder (visual) + smaller AABB collider so steps remain reachable
  decoCyl(out, cx, baseY + totalH / 2, cz, tR, totalH, C.cobble, { segments: 24 });
  solidBox(out, cx, baseY + totalH / 2, cz, tR * 0.7, totalH / 2, tR * 0.7, C.cobble);

  // Spiral steps. Each step's top y = (i+1)*stepRise. Top step (i=steps-1) tops out at exactly totalH.
  const turns = 2.5; // 22 steps over 2.5 turns ≈ 8.8 steps per turn ≈ 40.9°/step
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * turns * Math.PI * 2;
    const sx = cx + Math.cos(angle) * stepRadius;
    const sz = cz + Math.sin(angle) * stepRadius;
    const stepTopY = baseY + (i + 1) * stepRise;
    const halfY = stepRise / 2;
    const sy = stepTopY - halfY;
    const color = i % 2 === 0 ? C.wood : C.woodLight;
    solidBox(out, sx, sy, sz, 0.7, halfY, 0.7, color, { rotY: -angle, rough: 0.85 });
    // outer-edge rail post
    decoCyl(out, sx + Math.cos(angle) * 0.65, stepTopY + 0.35, sz + Math.sin(angle) * 0.65, 0.04, 0.7, C.wood);
  }

  // Top platform — thin so its underside doesn't create head-bump issues for
  // anyone on the second-to-top step. Top y = topY (matches spiral's last step).
  const platformHy = 0.06;
  solidBox(out, cx, topY - platformHy, cz, platformHx, platformHy, platformHx, C.cobble);
  // decorative trim band
  decoBox(out, cx, topY + 0.05, cz, platformHx + 0.05, 0.06, platformHx + 0.05, C.cobbleEdge, { cast: false });
  // Crenellations
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    decoBox(out, cx + Math.cos(a) * platformHx * 0.93, topY + 0.25, cz + Math.sin(a) * platformHx * 0.93, 0.18, 0.18, 0.18, C.cobbleEdge, { rotY: -a });
  }

  // No central spire — the top is open for all bridges to land cleanly.
  // Just a tall flag pole in the middle so the tower is visually distinct.
  decoCyl(out, cx, topY + 1.5, cz, 0.06, 3.0, C.wood);
  // Small lantern at top of the pole
  decoSphere(out, cx, topY + 3.1, cz, 0.18, C.lanternGlow, { emissive: C.lanternGlow, emissiveIntensity: 1.6 });
}

/** Stone tower with exterior wooden stairs spiraling once around it.
 *  Climb route #2 (east).
 *
 *  Geometry calibrated like the central spiral:
 *    - stepRadius (3.0) > platformHx + rxz (2.1 + 0.4 = 2.5) → no head bump
 *    - Top step's top y = topY = platform top y → no vertical mismatch on walk-on
 *    - Roof is decorative-only (no collider) so it doesn't trap players who jump
 *
 *  Per-step gap: ~0.64m vertical, ~1.3m horizontal — trivial.
 */
function outerScaffold(out: WorldData, cx: number, cz: number, topY: number, color = C.cobble) {
  const tw = 1.8;                       // tower half-extent
  const platformHx = tw + 0.3;          // 2.1
  const stepRadius = tw + 1.2;          // 3.0
  const steps = 14;
  const stepRise = topY / steps;        // ≈ 0.64

  // Tower body
  decoBox(out, cx, topY / 2, cz, tw, topY / 2, tw, color, { rough: 0.95 });
  out.boxes.push({ x: cx, y: topY / 2, z: cz, hx: tw * 0.9, hy: topY / 2, hz: tw * 0.9 });

  // External stairs — one full turn around the tower
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2 + 0.4;
    const sx = cx + Math.cos(angle) * stepRadius;
    const sz = cz + Math.sin(angle) * stepRadius;
    const stepTopY = (i + 1) * stepRise;
    const halfY = stepRise / 2;
    solidBox(out, sx, stepTopY - halfY, sz, 0.7, halfY, 0.7, C.wood, { rough: 0.85 });
    decoCyl(out, sx, stepTopY + 0.35, sz, 0.04, 0.7, C.wood);
  }

  // Top platform — small footprint inside the spiral's radius so steps don't push out
  solidBox(out, cx, topY - 0.05, cz, platformHx, 0.05, platformHx, C.cobbleEdge);
  // No roof — clear sky above. Just a flag pole at the center.
  decoCyl(out, cx, topY + 0.8, cz, 0.05, 1.4, C.wood);
  // Window halfway up the tower body
  decoBox(out, cx, topY * 0.55, cz + tw + 0.01, 0.35, 0.3, 0.04, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.55 });
  decoBox(out, cx, topY * 0.55, cz + tw + 0.01, 0.4, 0.35, 0.05, C.windowFrame);
}

/** Wooden watchtower — 4 corner posts with a TRUE LADDER on one side.
 *  Climb route #4 (north).
 *
 *  Player walks toward the +z face of the tower, enters the ladder volume,
 *  holds W to climb. Volume top = top platform top, so they exit onto the
 *  lookout platform smoothly.
 */
function watchtower(out: WorldData, cx: number, cz: number, topY: number) {
  const w = 1.4; // half-extent of the tower footprint
  // 4 corner posts (visual + each a slim collider so the structure has integrity)
  const postHy = topY / 2;
  for (const [sx, sz] of [[-w, -w], [w, -w], [-w, w], [w, w]] as const) {
    decoCyl(out, cx + sx, postHy, cz + sz, 0.12, topY, C.wood);
    out.boxes.push({ x: cx + sx, y: postHy, z: cz + sz, hx: 0.12, hy: postHy, hz: 0.12 });
  }
  // Cross-braces (decorative)
  for (const side of [[-w, 0, 1, 0], [w, 0, 1, 0], [0, -w, 0, 1], [0, w, 0, 1]] as const) {
    decoBox(out, cx + side[0], topY * 0.4, cz + side[1], 0.05, 0.6, 0.05, C.wood, { rotY: side[2] === 1 ? 0.6 : -0.6 });
  }
  // Top lookout platform — thin so it doesn't head-bump anyone climbing the ladder
  const lookoutTopY = topY + 0.1;
  solidBox(out, cx, lookoutTopY - 0.05, cz, w + 0.6, 0.05, w + 0.6, C.plank, { rough: 0.85 });
  // Low railing posts (decorative)
  for (const [sx, sz] of [[-w, -w], [w, -w], [-w, w], [w, w]] as const) {
    decoCyl(out, cx + sx, lookoutTopY + 0.4, cz + sz, 0.05, 0.7, C.wood);
  }
  // Watch-fire on a slim pole at center (no roof — clear sky above the lookout)
  decoCyl(out, cx, lookoutTopY + 0.8, cz, 0.05, 1.4, C.wood);
  decoSphere(out, cx, lookoutTopY + 1.6, cz, 0.18, C.lanternGlow, { emissive: C.lanternGlow, emissiveIntensity: 1.4 });

  // TRUE LADDER on the +z face. Player approaches from south (positive z) and
  // climbs from ground to the lookout deck. ladderVolume internally extends the
  // volume 1.2m above lookoutTopY so the climb-through-platform phase doesn't
  // get pushed off by the platform's underside.
  ladderVolume(out, {
    cx,
    cz: cz + w + 0.25,
    baseY: 0,
    topY: lookoutTopY,
    faceX: 0, faceZ: 1,
    width: 1.2,
  });
}

/** Tavern — 2-story building with external stairs to a balcony, then a TRUE
 *  LADDER up the east face to a small landing pad at y=9.4 that bridges to
 *  the central tower top.
 *  Climb route #5 (south).
 *
 *  Path gap math:
 *  - 5 external stair steps: each 0.56m rise, trivial walk-up
 *  - balcony at y=2.8 → ladder volume → landing pad at y=9.4 (climb 6.6m)
 *  - landing pad → bridge to central tower top (both at y=9.4, flat)
 */
function tavern(out: WorldData, cx: number, cz: number, baseY = 0): { landingX: number; landingZ: number; landingY: number } {
  const w = 4, d = 3.5, h1 = 2.6;
  // First-floor walls
  solidBox(out, cx, baseY + h1 / 2, cz, w / 2, h1 / 2, d / 2, C.wallCream, { rough: 0.9 });
  decoBox(out, cx, baseY + h1 + 0.05, cz, w / 2 + 0.1, 0.06, d / 2 + 0.1, C.wood, { cast: false });
  // Second-floor (narrower) walls — decorative silhouette
  const h2 = 1.8;
  solidBox(out, cx, baseY + h1 + 0.12 + h2 / 2, cz, w / 2 - 0.3, h2 / 2, d / 2 - 0.3, C.wallOlive, { rough: 0.9 });
  // Flatter pyramid roof — solid collider
  const roofR = w / 2 - 0.3;
  const roofH = 1.0;        // was 1.6 — flatter
  const roofCY = baseY + h1 + 0.12 + h2 + 0.12 + roofH / 2;
  decoCone(out, cx, roofCY, cz, roofR * Math.SQRT2, roofH, C.roofRed, { rotY: Math.PI / 4, segments: 4 });
  out.boxes.push({ x: cx, y: roofCY, z: cz, hx: roofR, hy: roofH / 2, hz: roofR });

  // External stairs on the +z side up to a balcony at y=2.8 (5 steps of 0.56m rise — trivial)
  stairFlight(out, {
    startX: cx - w / 2 - 0.2, startZ: cz + d / 2 + 0.4,
    dirX: 1, dirZ: 0,
    steps: 5, stepRise: (h1 + 0.2) / 5, stepRun: 0.6, width: 1.2,
    color: C.wood, railColor: C.woodDark,
  });
  // Balcony deck along the +z side
  const balconyY = baseY + h1 + 0.2;
  solidBox(out, cx, balconyY, cz + d / 2 + 0.8, w / 2 + 0.3, 0.08, 0.6, C.plank);

  // Tall TRUE LADDER from balcony up to the landing pad at y=9.4
  const landingY = 9.4;
  const ladderX = cx + w / 2 + 0.6;
  const ladderZ = cz + d / 2 + 0.8;
  ladderVolume(out, {
    cx: ladderX, cz: ladderZ,
    baseY: balconyY + 0.1,
    topY: landingY,
    faceX: 1, faceZ: 0,
    width: 1.0,
  });

  // Landing pad at top of the ladder (hand-tuned so the player can step off
  // the ladder into the pad horizontally without head-bumping)
  const padHx = 0.9;
  solidBox(out, ladderX, landingY - 0.05, ladderZ, padHx, 0.05, padHx, C.plank, { rough: 0.85 });
  // Small rail post on the pad (visual)
  decoCyl(out, ladderX + padHx, landingY + 0.4, ladderZ, 0.04, 0.8, C.wood);
  decoCyl(out, ladderX - padHx, landingY + 0.4, ladderZ, 0.04, 0.8, C.wood);

  // Sign hanging out front
  decoCyl(out, cx - w / 2 - 0.1, baseY + h1 - 0.1, cz - d / 2 + 0.3, 0.06, 0.6, C.wood, { rotY: Math.PI / 2 });
  decoBox(out, cx - w / 2 - 0.5, baseY + h1 - 0.5, cz - d / 2 + 0.3, 0.04, 0.45, 0.6, C.woodLight);
  decoBox(out, cx - w / 2 - 0.5, baseY + h1 - 0.5, cz - d / 2 + 0.3, 0.05, 0.4, 0.55, '#fef9c3', { emissive: '#fef9c3', emissiveIntensity: 0.3 });
  // Door
  decoBox(out, cx, baseY + 0.8, cz - d / 2 - 0.01, 0.4, 0.8, 0.04, C.doorBrown);
  decoBox(out, cx, baseY + 0.8, cz - d / 2 - 0.01, 0.45, 0.85, 0.05, C.windowFrame);
  // Windows
  for (const sx of [-1.2, 1.2]) {
    decoBox(out, cx + sx, baseY + 1.5, cz - d / 2 - 0.01, 0.3, 0.3, 0.04, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.7 });
    decoBox(out, cx + sx, baseY + 1.5, cz - d / 2 - 0.01, 0.35, 0.35, 0.05, C.windowFrame);
  }
  // Chimney
  decoBox(out, cx - w / 4, roofCY + roofH / 2 + 0.5, cz - d / 4, 0.25, 0.7, 0.25, '#7f1d1d');
  out.smoke.push({ x: cx - w / 4, y: roofCY + roofH / 2 + 1.3, z: cz - d / 4 });

  return { landingX: ladderX, landingZ: ladderZ, landingY };
}

// ────────────────────── helpers ──────────────────────

function shadeColor(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.min(255, Math.max(0, Math.floor(((n >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.floor(((n >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.floor((n & 0xff) * factor)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ────────────────────── main generator ──────────────────────

export function generateWorld(seed = 1337): WorldData {
  const rng = makeRng(seed);
  const out: WorldData = {
    boxes: [],
    ladders: [],
    movers: [],
    meshes: [],
    windmills: [],
    flags: [],
    smoke: [],
    goal: { x: 0, y: 0, z: 0 },
    maxHeight: 0,
  };

  // ─────────────────────────────────────────────────────────────
  //                       GROUND + PLAZA
  // ─────────────────────────────────────────────────────────────
  // 120m × 120m grass plate.
  solidBox(out, 0, -0.5, 0, 60, 0.5, 60, C.grass, { rough: 1, receive: true });
  // Light grass-tone variation patches (decorative)
  for (let i = 0; i < 40; i++) {
    const ax = (rng() * 2 - 1) * 55;
    const az = (rng() * 2 - 1) * 55;
    decoBox(out, ax, 0.015, az, 0.6 + rng() * 0.8, 0.015, 0.6 + rng() * 0.8, rng() > 0.5 ? C.grassDark : C.grassDeep, { cast: false });
  }
  // Cobblestone plaza (8×8 tiles, center reserved for the well)
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const a = (i - 3.5) * 1.0;
      const b = (j - 3.5) * 1.0;
      if (Math.abs(a) < 1.5 && Math.abs(b) < 1.5) continue;
      pathTile(out, a, b, 0.85 + rng() * 0.25);
    }
  }
  well(out, 0, 0, 0);
  // Path pavers radiating to each climbing structure and cottage
  const radials: [number, number][] = [
    [-14, -14], [14, -14], [-14, 14], [14, 14],   // 4 cottage diagonals
    [-16, 0], [16, 0], [0, -16], [0, 16],         // 4 cardinal climbing structures
    [-28, 28], [28, -28],                          // alt-route landmarks
  ];
  for (const [tx, tz] of radials) {
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      pathTile(out, tx * t * 0.8, tz * t * 0.8, 0.95);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //                         COTTAGES (decorative)
  // ─────────────────────────────────────────────────────────────
  // 4 cottages at the diagonals — flavor only, the climbing routes
  // are dedicated structures at the cardinal points.
  type Cottage = {
    cx: number; cz: number; wall: string; roof: string;
    door: 'north' | 'south' | 'east' | 'west';
    garden?: boolean;
  };
  const cottages: Cottage[] = [
    { cx: -14, cz:  14, wall: C.wallCream, roof: C.roofRed,   door: 'east',  garden: true  },
    { cx:  14, cz:  14, wall: C.wallMint,  roof: C.roofTeal,  door: 'west',  garden: true  },
    { cx: -14, cz: -14, wall: C.wallPink,  roof: C.roofLav,   door: 'east'                 },
    { cx:  14, cz: -14, wall: C.wallSky,   roof: C.roofCoral, door: 'west',  garden: true  },
  ];
  for (const c of cottages) {
    cottage(out, {
      cx: c.cx, cz: c.cz, baseY: 0,
      wallW: 4.0, wallD: 4.0,           // square footprint so the roof cap doesn't overhang
      wallH: 2.5,                       // single jump from ground (apex 3m) clears this
      roofH: 1.0,                       // flatter decorative cap
      wallColor: c.wall, roofColor: c.roof,
      doorFace: c.door, hasGarden: c.garden,
    });
  }
  // Perimeter fence with gaps at the 4 cardinal directions
  const fenceR = 36;
  const gaps = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  for (let i = 0; i < 56; i++) {
    const a1 = (i / 56) * Math.PI * 2;
    const a2 = ((i + 1) / 56) * Math.PI * 2;
    let nearGap = false;
    for (const g of gaps) {
      let d = Math.abs(((a1 + a2) / 2) - g);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < 0.18) nearGap = true;
    }
    if (nearGap) continue;
    fenceSegment(out, Math.cos(a1) * fenceR, Math.sin(a1) * fenceR, Math.cos(a2) * fenceR, Math.sin(a2) * fenceR);
  }

  // ─────────────────────────────────────────────────────────────
  //                  CLIMBING ROUTES (8 paths)
  // ─────────────────────────────────────────────────────────────
  // Player physics constraints:
  //   single jump apex ≈ 3.0m (vy² / 2g = 169/56)
  //   double jump apex ≈ 4.8m
  //   single flat horizontal jump ≈ 6.5m, double ≈ 9m
  //   climb ladder = walk in volume, hold W = +4 m/s up
  //
  // Difficulty bands:
  //   trivial: gap ≤ 1m  (walk-up)
  //   easy:    gap ≤ 2m  (comfortable single jump)
  //   medium:  gap ≤ 2.7m
  //   hard:    gap ≤ 3.0m (right at single-jump limit)
  //   double:  gap ≤ 4.5m (requires double jump)

  // ── PATH 1: central spiral tower (the SPINE)
  //    22 steps of 0.43m rise each, radius 3.7 → outside platform footprint
  //    → top step's top y = 9.4 = platform top y → seamless walk-on.
  spiralTower(out, 0, 0, 0, 9.4);
  out.flags.push({ x: 0, y: 9.4 + 2.4, z: 0, rotY: 0, color: C.flag1 });

  // ── PATH 2: East stone tower (merges at central tower top, y=9.4)
  //    14 steps of 0.64m rise, stair radius 3.0, platform half-extent 2.1.
  //    Top step y=9.4 matches platform top.
  outerScaffold(out, 16, 0, 9.4, C.cobble);
  out.flags.push({ x: 16, y: 11.7, z: 0, rotY: Math.PI / 2, color: C.flag2 });
  //    Bridge across: ~11m horizontal, flat at y=9.4 → trivial walk.
  bridge(out, 16 - 2.1, 0, 0 + 2.8, 0, 9.4);

  // ── PATH 3: West climbing tree (merges at central tower top)
  //    6 branch platforms at y=1.5, 3.0, 4.5, 6.0, 7.5, 9.0
  //    Each gap 1.5m vertical, ~2.5m horizontal → easy single jump.
  climbingTree(out, -16, 0, 9.0);
  //    Bridge from top branch (y≈9.0) to central tower (y=9.4). Small step up.
  bridge(out, -16 + 0.6, 0, -2.8, 0, 9.2);

  // ── PATH 4: North watchtower with TRUE LADDER
  //    Player walks into the volume on the +z face and holds W; climbs 9.4m.
  watchtower(out, 0, -16, 9.4);
  out.flags.push({ x: 0, y: 9.4 + 2.7, z: -16, rotY: 0, color: C.flag4 });
  //    Bridge from lookout (y=9.4) to central tower top, ~13m, flat.
  bridge(out, 0, -16 + 2.0, 0, -2.8, 9.4);

  // ── PATH 5: South tavern (stairs + TRUE LADDER + bridge)
  //    External stairs to balcony at y=2.8 → vertical ladder to landing pad at y=9.4.
  const tavernResult = tavern(out, 0, 16);
  out.flags.push({ x: -2, y: 3.1, z: 16 - 1.75, rotY: 0, color: C.flag3 });
  //    From the tavern's landing pad → mid-air stepping platform → central tower.
  //    landingX = 0 + 4/2 + 0.6 = 2.6, landingZ = 16 + 3.5/2 + 0.8 = 18.55
  bridge(out, tavernResult.landingX, tavernResult.landingZ - 0.9, 1.5, 11, 9.4);
  bridge(out, 1.5, 10.1, 0, 2.8, 9.4);

  // ── PATH 6: NW tall climbing tree (merges HIGHER — at the first stepper above tower)
  //    Tall trunk with branches at y=1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5
  //    Each gap 1.5m, easy. Total height matches first central stepper (y=11.4).
  climbingTree(out, -26, 26, 10.5);
  //    Aerial walkway from tree top to first central stepper.
  //    Two intermediate platforms keep each bridge ≤ 12m.
  platform(out, -18, 11.0, 18, 1.2, 1.2, C.dirt, C.grassDeep);
  platform(out,  -9, 11.4, 8,  1.2, 1.2, C.dirt, C.grassDeep);
  bridge(out, -25.4, 25.4, -19.2, 19.2, 11.0);
  bridge(out, -16.8, 16.8,  -9.7, 9.0,  11.2);
  // Bridge from mid-platform 2 to the first central stepping stone (3, 11.4, 1)
  bridge(out, -7.8, 8,  3.0, 1.0, 11.4);

  // ── PATH 7: SE precision platforms (merges at central tower top)
  //    Small floating pillars stepping diagonally in toward the center.
  //    Each gap ~5.7m horizontal at ~1.5m up — single jump apex 3.0m can reach
  //    horizontal ≈5.55m at 1.5m up. So this path is right at single-jump LIMIT
  //    (HARD); use double jump for comfortable margin.
  platform(out, 24, 2.0, -24, 0.55, 0.55, C.dirtDark, C.grassDark); // start, ~2m up from ground
  platform(out, 20, 3.5, -20, 0.55, 0.55, C.dirtDark, C.grassDark); // 5.66m horiz, 1.5m up — HARD
  platform(out, 16, 5.0, -16, 0.55, 0.55, C.dirtDark, C.grassDark); // HARD
  platform(out, 12, 6.5, -12, 0.55, 0.55, C.dirtDark, C.grassDark); // HARD
  platform(out,  8, 8.0,  -8, 0.6,  0.6,  C.dirtDark, C.grassDark); // HARD
  platform(out,  4, 9.4,  -4, 0.7,  0.7,  C.dirtDark, C.grassDark); // 5.66m horiz, 1.4m up — HARD
  //    Final step onto central tower top: from (4, 9.4, -4) to (2.8, 9.4, -2.8)
  //    1.7m horizontal flat → trivial walk-jump
  out.flags.push({ x: 24, y: 3.5, z: -24, rotY: -Math.PI / 4, color: C.flag5 });

  // ─────────────────────────────────────────────────────────────
  //              SPINE: central tower top → goal
  // ─────────────────────────────────────────────────────────────
  // y=9.4 (central tower top)
  //  → stepper at y=11.4 (gap 2m, easy)
  //  → stepper at y=13.4
  //  → stepper at y=15.4
  //  → stepper at y=17.4
  //  → floating cottage 1 base at y=18 (gap 0.6m, walk)
  //  → bridge to floating cottage 2 (y=21) — handled below
  //  → windmill base ladder up to y=30 (TRUE LADDER)
  //  → cloud staircase 32 → 34 → 36 → 38
  //  → crystal spires 40 → 41.2 → 42.5
  //  → goal y=46

  // Stepping stones above the tower — tight spacing so every gap is a single jump
  //   gap from tower edge (radius 2.8) → s1: 1m horiz, 2m up — trivial
  //   s1 → s2: 4.5m horiz, 2m up — easy (single jump max ≈5.14m at 2m up)
  //   s2 → s3: 3.9m horiz, 2m up — easy
  //   s3 → s4: 4.3m horiz, 2m up — easy
  platform(out,  3.0, 11.4,  1.0, 1.0, 1.0, C.dirtDark, C.grassDeep);  // s1
  platform(out, -1.0, 13.4, -1.0, 1.0, 1.0, C.dirtDark, C.grassDeep);  // s2
  platform(out,  2.0, 15.4,  1.5, 1.0, 1.0, C.dirtDark, C.grassDeep);  // s3
  platform(out, -1.5, 17.4, -1.0, 1.2, 1.2, C.dirtDark, C.grassDeep);  // s4

  // Floating cottage 1 (lavender + gold) — base platform reachable from stepper 4
  const floatY = 18;
  solidBox(out, -3, floatY - 0.1, -5, 2.2, 0.1, 2.0, C.grassDeep);
  decoBox(out, -3, floatY + 0.02, -5, 2.2, 0.04, 2.0, C.grass, { cast: false });
  solidBox(out, -3, floatY + 1.0, -5, 1.5, 1.0, 1.3, C.wallLav);
  decoCone(out, -3, floatY + 2.7, -5, 1.55 * Math.SQRT2, 1.3, C.roofGold, { rotY: Math.PI / 4, segments: 4 });
  out.boxes.push({ x: -3, y: floatY + 2.7, z: -5, hx: 1.55, hy: 0.65, hz: 1.55 });
  decoBox(out, -3.5, floatY + 1.2, -3.7, 0.3, 0.25, 0.04, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.7 });
  decoBox(out, -2.4, floatY + 2.3, -5.5, 0.18, 0.5, 0.18, '#7f1d1d');
  out.smoke.push({ x: -2.4, y: floatY + 2.8, z: -5.5 });
  // Bridge: stepper 4 (-1.5, 17.4, -1) → cottage 1 base (-3, 18, -5). Gap 0.6m up, ~4m horiz.
  bridge(out, -1.5, -1.0, -3.0, -3.0, 17.7);

  // Floating cottage 2 (cream + teal) — reachable from cottage 1 via bridge
  const floatY2 = 21;
  solidBox(out, 5, floatY2 - 0.1, 2, 2.2, 0.1, 2.0, C.grassDeep);
  decoBox(out, 5, floatY2 + 0.02, 2, 2.2, 0.04, 2.0, C.grass, { cast: false });
  solidBox(out, 5, floatY2 + 1.0, 2, 1.5, 1.0, 1.3, C.wallCream);
  decoCone(out, 5, floatY2 + 2.7, 2, 1.55 * Math.SQRT2, 1.3, C.roofTeal, { rotY: Math.PI / 4, segments: 4 });
  out.boxes.push({ x: 5, y: floatY2 + 2.7, z: 2, hx: 1.55, hy: 0.65, hz: 1.55 });
  decoBox(out, 5, floatY2 + 1.2, 3.3, 0.3, 0.25, 0.04, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.7 });
  decoBox(out, 5.5, floatY2 + 2.3, 1.5, 0.18, 0.5, 0.18, '#7f1d1d');
  out.smoke.push({ x: 5.5, y: floatY2 + 2.8, z: 1.5 });
  // Bridge cottage 1 base → cottage 2 base: 4m horiz, 3m up — handled as inclined plank
  bridge(out, -1.0, -4.5, 3.5, 0.7, 20.0);
  // small landing step between them
  platform(out, 1.2, 19.5, -2.0, 0.6, 0.6, C.dirtDark, C.grassDeep);

  // ── Windmill tower with TRUE LADDER up its exterior ──
  const wmBaseY = 23;
  const wmTowerH = 6.5;        // tower top y = 29.5; with cap platform → 30
  const wmCX = 10, wmCZ = -6;
  decoCyl(out, wmCX, wmBaseY + wmTowerH / 2, wmCZ, 0.9, wmTowerH, C.cobble, { segments: 14 });
  solidBox(out, wmCX, wmBaseY + wmTowerH / 2, wmCZ, 0.7, wmTowerH / 2, 0.7, C.cobble);
  // Cap platform — top y = 30. Player will exit ladder onto this.
  solidBox(out, wmCX, 29.95, wmCZ, 1.6, 0.05, 1.6, C.cobbleEdge);
  // Decorative roof, no collider
  decoCone(out, wmCX, 30 + 1.0, wmCZ, 2.0, 1.6, C.roofGold, { rotY: Math.PI / 4, segments: 4 });
  out.windmills.push({ x: wmCX, y: wmBaseY + wmTowerH * 0.7, z: wmCZ + 0.85, rotY: 0 });
  // TRUE LADDER on the +z face of the windmill, from windmill base entry y=23 up to y=30
  ladderVolume(out, {
    cx: wmCX, cz: wmCZ + 1.0,
    baseY: 23, topY: 30,
    faceX: 0, faceZ: 1,
    width: 1.1,
  });
  // Bridge from floating cottage 2 base → windmill ladder entry at y=23
  // cottage 2 base top is y=floatY2 (21). Need to reach y=23 ladder base.
  // Use a small mid-stepper.
  platform(out, 7.5, 22.0, -2, 0.8, 0.8, C.dirtDark, C.grassDeep);
  bridge(out, 5.0 + 1.6, 2.0, 7.5, -2.0 + 0.8, 22.2);
  bridge(out, 7.5, -2.8, wmCX, wmCZ + 1.15, 23.0);

  // ── ONE CLOUD AT THE TOP, REACHED VIA MOVING PLATFORM ONLY ──
  // The whole cloud staircase has been replaced by a single timing-gated
  // moving-platform ride. Player must:
  //   1. Stand on the windmill cap (y=30)
  //   2. Jump to the moving platform when it's at its LOW endpoint
  //   3. Ride it up to the HIGH endpoint
  //   4. Hop off onto the cloud
  //   5. Climb the crystals to the goal
  // The Player code carries riders so the platform doesn't slide out from
  // under you mid-ride.

  // Moving platform — endpoints chosen so each jump on/off is single-jump-easy
  //   windmill cap (10, 30, -6) → mover LOW (6, 31, -4): 4.47m horiz, 1m up — EASY
  //   mover HIGH (1, 37, 0) → the cloud (-1, 37, 2): 2.83m horiz, flat — EASY
  mover(out, {
    ax: 6, ay: 31, az: -4,
    bx: 1, by: 37, bz: 0,
    hx: 1.5, hy: 0.18, hz: 1.5,    // 3m × 3m × 0.36m — large + thick so swept landing is reliable
    period: 7, phase: 0,
    color: C.roofGold,
  });

  // The single cloud — landing pad after the moving platform
  cloudPlatform(out, -1, 37, 2, 1.8);

  // ── Crystal spires up to the goal ──
  //    All gaps from the cloud and between crystals are EASY single jumps.
  //    Crystal caps are now 1.6m squared (was 0.9m) so landing is forgiving.
  //   cloud (-1, 37, 2) → crystal-1 cap (-1, 39.5, 1): 1.0m horiz, 2.5m up — EASY
  //   crystal-1 → crystal-2: 2.24m horiz, 1.0m up — EASY
  //   crystal-2 → crystal-3: 2.24m horiz, 1.0m up — EASY
  //   crystal-3 → goal pad:   1.4m horiz, 0.5m up — TRIVIAL
  crystal(out, -1, 38.0, 1,  1.5);   // cap top y ≈ 39.6
  crystal(out,  1, 39.0, 0,  1.5);   // cap top y ≈ 40.6
  crystal(out, -1, 40.0, -1, 1.5);   // cap top y ≈ 41.6

  // ── Final goal pad and orb ──
  const goalY = 42.0;
  solidBox(out, 0, goalY - 0.4, 0, 1.6, 0.2, 1.6, C.crystalA);
  decoCone(out, 0, goalY - 0.85, 0, 1.8, 0.7, C.crystalA, { rotY: 0, segments: 8 });
  out.goal = { x: 0, y: goalY + 0.6, z: 0 };

  // ─────────────────────────────────────────────────────────────
  //                  DECORATIONS + FLAVOR
  // ─────────────────────────────────────────────────────────────
  // Peripheral trees
  const treePositions: Array<{ x: number; z: number; kind: 'tree' | 'pine' | 'blossom'; size: number }> = [
    { x: -32, z:  22, kind: 'blossom', size: 4 },
    { x:  32, z:  22, kind: 'tree',    size: 5 },
    { x: -32, z: -22, kind: 'pine',    size: 6 },
    { x:  32, z: -22, kind: 'tree',    size: 5 },
    { x:   8, z:  30, kind: 'blossom', size: 3.5 },
    { x:  -8, z:  30, kind: 'blossom', size: 4 },
    { x:  14, z: -28, kind: 'tree',    size: 4 },
    { x: -14, z: -28, kind: 'pine',    size: 5 },
    { x:   0, z:  34, kind: 'pine',    size: 5 },
    { x:  34, z:   0, kind: 'pine',    size: 6 },
    { x: -34, z:   8, kind: 'tree',    size: 5 },
    { x: -34, z: -10, kind: 'blossom', size: 4 },
    { x:  34, z:  10, kind: 'tree',    size: 5 },
    { x:   6, z:   8, kind: 'blossom', size: 2.8 },
    { x:  -6, z:   8, kind: 'tree',    size: 3 },
    { x:  -6, z:  -8, kind: 'blossom', size: 3 },
    { x:   6, z:  -8, kind: 'pine',    size: 3.5 },
  ];
  for (const t of treePositions) {
    if (t.kind === 'tree') tree(out, { x: t.x, z: t.z, height: t.size });
    else if (t.kind === 'pine') pineTree(out, t.x, t.z, t.size);
    else blossomTree(out, t.x, t.z, t.size);
  }

  // Lanterns along the plaza ring
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    lantern(out, Math.cos(ang) * 7, 0, Math.sin(ang) * 7, 2.2);
  }
  for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]] as const) {
    lantern(out, lx, 0, lz, 2.6);
  }

  // Mushrooms — varied colors, scattered around the perimeter
  for (let i = 0; i < 50; i++) {
    const ang = rng() * Math.PI * 2;
    const r = 12 + rng() * 30;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const c: 'red' | 'purple' | 'blue' = rng() > 0.7 ? 'purple' : rng() > 0.5 ? 'blue' : 'red';
    mushroom(out, x, z, 0.6 + rng() * 0.7, c);
  }

  // Flower patches
  for (let i = 0; i < 36; i++) {
    const ang = rng() * Math.PI * 2;
    const r = 8 + rng() * 30;
    flowerPatch(out, Math.cos(ang) * r, Math.sin(ang) * r, 5 + Math.floor(rng() * 5), rng);
  }

  // Village clutter
  barrel(out, -3, 16 + 1.7);
  barrel(out, -3.5, 16 + 2.4);
  barrel(out, 3.2, 16 + 1.7);
  haystack(out, 2.5, -16 - 1.1);
  haystack(out, 3.2, -16 + 1.5);
  haystack(out, -2.8, -16 - 2.0);
  bench(out, -4, 4, Math.PI / 4);
  bench(out, 4, -4, -Math.PI / 4);
  bench(out, -4, -4, -Math.PI / 4);
  sign(out, -7, -7, Math.PI / 4, C.wallOlive);
  sign(out,  7,  7, -Math.PI * 3 / 4, C.wallPeach);
  sign(out, -14, 0, Math.PI / 2, C.wallMint);
  sign(out,  14, 0, -Math.PI / 2, C.wallSky);
  // Flags on each cottage roof
  for (const c of cottages) {
    out.flags.push({ x: c.cx, y: 4.6, z: c.cz, rotY: 0, color: [C.flag1, C.flag2, C.flag3, C.flag4, C.flag5][Math.floor(rng() * 5)] });
  }

  out.maxHeight = goalY + 0.6;
  return out;
}

// ────────────────────── spawn points ──────────────────────

/** Spawn points on the larger map — outside the village, near the perimeter. */
export const SPAWN_POINTS: ReadonlyArray<readonly [number, number, number]> = [
  [-26,  1,  26],
  [ 26,  1,  26],
  [-26,  1, -26],
  [ 26,  1, -26],
  [-34,  1,   8],
  [ 34,  1,   8],
  [-34,  1,  -8],
  [ 34,  1,  -8],
  [  8,  1,  34],
  [ -8,  1,  34],
  [  8,  1, -34],
  [ -8,  1, -34],
];

export function spawnFor(socketId: string): { x: number; y: number; z: number } {
  let h = 0;
  for (let i = 0; i < socketId.length; i++) h = (h * 31 + socketId.charCodeAt(i)) >>> 0;
  const [x, y, z] = SPAWN_POINTS[h % SPAWN_POINTS.length];
  return { x, y, z };
}
