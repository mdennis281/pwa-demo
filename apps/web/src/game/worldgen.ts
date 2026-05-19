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
  /** 'platform' carries the player when standing on top; 'wall' is a hazard
   *  that pushes the player horizontally and does not carry. */
  kind: 'platform' | 'wall';
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
  kind?: 'platform' | 'wall';
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
    kind: opts.kind ?? 'platform',
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
  // Half-grade pyramid roof, flush with the post tops at y=baseY+2.6
  decoCone(out, cx, baseY + 2.74, cz, rimR * 1.4, 0.28, C.roofRed, { rotY: Math.PI / 4, segments: 4 });
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

/** A unified climbing spoke. All 8 spokes share this exact vertical/horizontal
 *  profile — only the rotation, colors, and entry-pad decoration change. This
 *  gives the player a consistent, refined approach from any direction.
 *
 *  Layout (along the spoke's radial direction, looking inward):
 *    entry pad     y=0.0   radius rOuter  (2.0×2.0 cobble pad, flag)
 *    step 1        y=1.6   radius rOuter - 2.8
 *    step 2        y=3.2   radius rOuter - 5.6
 *    step 3        y=4.8   radius rOuter - 8.4
 *    step 4        y=6.4   radius rOuter - 11.2
 *    step 5        y=8.0   radius rOuter - 14.0
 *    landing pad   y=9.4   radius rInner  (1.2×1.2 themed pad)
 *    → short flat bridge to central tower edge at radius rTower
 *
 *  Gap math per step: 1.6m up + ~2.8m horizontal. Single-jump apex 3m can
 *  reach ~5.5m horizontal at 1.6m up, so every gap is comfortably in the
 *  EASY band. Spoke faces straight inward — no zigzag.
 */
function climbSpoke(out: WorldData, opts: {
  angle: number;
  rOuter: number;
  rInner: number;
  rTower: number;
  mergeY: number;
  baseColor: string;
  topColor: string;
  flagColor: string;
  /** Small decorative landmark at the entry pad — purely visual */
  marker?: 'lantern' | 'pine' | 'blossom' | 'mushroom';
}) {
  const cosA = Math.cos(opts.angle);
  const sinA = Math.sin(opts.angle);
  const numSteps = 5;
  const stepRise = 1.6;                       // y of step i = i * stepRise
  const radialSpan = opts.rOuter - opts.rInner;
  const radialStep = radialSpan / (numSteps + 1); // ≈ 2.83 with 22→5 / 6

  // Entry pad — a clearly-marked landing spot at ground level
  const ex = cosA * opts.rOuter;
  const ez = sinA * opts.rOuter;
  platform(out, ex, 0.4, ez, 1.0, 1.0, C.cobbleDark, C.cobble);
  decoBox(out, ex, 0.45, ez, 1.05, 0.05, 1.05, C.cobbleEdge, { cast: false });
  // Flag pole at the back of the entry pad so each direction has a marker
  const px = cosA * (opts.rOuter + 0.7);
  const pz = sinA * (opts.rOuter + 0.7);
  decoCyl(out, px, 1.6, pz, 0.05, 2.8, C.wood);
  decoBox(out, px - cosA * 0.4, 2.5, pz - sinA * 0.4, 0.4, 0.3, 0.04, opts.flagColor, { rotY: opts.angle });
  out.flags.push({ x: ex, y: 0.5, z: ez, rotY: opts.angle, color: opts.flagColor });

  // Optional cosmetic landmark next to the entry pad
  if (opts.marker === 'lantern') {
    lantern(out, ex + sinA * 1.6, 0, ez - cosA * 1.6, 2.6);
    lantern(out, ex - sinA * 1.6, 0, ez + cosA * 1.6, 2.6);
  } else if (opts.marker === 'pine') {
    pineTree(out, ex + sinA * 2.4, ez - cosA * 2.4, 3.5);
  } else if (opts.marker === 'blossom') {
    blossomTree(out, ex + sinA * 2.4, ez - cosA * 2.4, 3.0);
  } else if (opts.marker === 'mushroom') {
    mushroom(out, ex + sinA * 1.4, ez - cosA * 1.4, 1.2, 'red');
    mushroom(out, ex - sinA * 1.4, ez + cosA * 1.4, 0.9, 'purple');
  }

  // 5 stepping platforms ascending toward the tower
  for (let i = 1; i <= numSteps; i++) {
    const r = opts.rOuter - i * radialStep;
    const y = i * stepRise;
    const x = cosA * r;
    const z = sinA * r;
    // Slightly larger pads for the final two steps so the approach to the
    // landing pad reads cleanly
    const hxz = i >= 4 ? 0.9 : 0.75;
    platform(out, x, y, z, hxz, hxz, opts.baseColor, opts.topColor);
    // Soft railing post on the outboard edge (purely visual hint)
    if (i === 2 || i === 4) {
      const rx = cosA * (r + 0.6);
      const rz = sinA * (r + 0.6);
      decoCyl(out, rx, y + 0.45, rz, 0.04, 0.9, C.wood);
      decoSphere(out, rx, y + 0.95, rz, 0.1, opts.flagColor);
    }
  }

  // Landing pad at the merge height — ring of 8 identical pads at radius rInner
  const lx = cosA * opts.rInner;
  const lz = sinA * opts.rInner;
  platform(out, lx, opts.mergeY, lz, 1.2, 1.2, opts.baseColor, opts.topColor);
  decoBox(out, lx, opts.mergeY + 0.06, lz, 1.25, 0.04, 1.25, C.cobbleEdge, { cast: false });

  // Short, flat bridge from landing pad to the central tower edge
  bridge(out, lx, lz, cosA * opts.rTower, sinA * opts.rTower, opts.mergeY);
}

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
      roofH: 0.5,                       // half-grade decorative cap — easier silhouette to land on
      wallColor: c.wall, roofColor: c.roof,
      doorFace: c.door, hasGarden: c.garden,
    });
  }
  // Perimeter fence with gaps aligned to the 8 spoke directions (π/8 offset
  // so spokes thread between the 4 diagonal cottages — see climbSpoke block)
  const fenceR = 36;
  const SPOKE_OFFSET = Math.PI / 8;
  const gaps = [0, 1, 2, 3, 4, 5, 6, 7].map(i => SPOKE_OFFSET + i * Math.PI / 4);
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

  // ── SPINE: central spiral tower (route #0 — the destination all spokes feed into)
  //    22 steps of 0.43m rise each, radius 3.7 → outside platform footprint
  //    → top step's top y = 9.4 = platform top y → seamless walk-on.
  spiralTower(out, 0, 0, 0, 9.4);
  out.flags.push({ x: 0, y: 9.4 + 2.4, z: 0, rotY: 0, color: C.flag1 });

  // ── 8 IDENTICAL SPOKES around the central tower ───────────────────
  //    Each spoke uses the same vertical/horizontal profile (climbSpoke);
  //    only the rotation, colors, and entry-pad landmark differ. All 8
  //    merge at y=9.4 on a landing ring at radius 5, then bridge into
  //    the central tower top (radius ~2.8). Every gap is EASY.
  //
  //    Spokes are offset by π/8 (22.5°) from the cardinal axes so they
  //    thread BETWEEN the 4 diagonal cottages (at ±14, ±14) instead of
  //    colliding with them. The fence perimeter has 8 matching gaps.
  const spokeColors: Array<{ base: string; top: string; flag: string; marker: 'lantern' | 'pine' | 'blossom' | 'mushroom' }> = [
    { base: C.dirt,      top: C.grassDeep,  flag: C.flag2, marker: 'lantern' },
    { base: C.dirtDark,  top: C.grassDark,  flag: C.flag5, marker: 'mushroom' },
    { base: C.dirt,      top: C.grassDeep,  flag: C.flag3, marker: 'blossom' },
    { base: C.dirtDark,  top: C.grassDark,  flag: C.flag1, marker: 'pine' },
    { base: C.dirt,      top: C.grassDeep,  flag: C.flag2, marker: 'blossom' },
    { base: C.dirtDark,  top: C.grassDark,  flag: C.flag5, marker: 'pine' },
    { base: C.dirt,      top: C.grassDeep,  flag: C.flag4, marker: 'lantern' },
    { base: C.dirtDark,  top: C.grassDark,  flag: C.flag1, marker: 'mushroom' },
  ];
  const rTowerEdge = 2.8;
  for (let i = 0; i < 8; i++) {
    const angle = SPOKE_OFFSET + (i / 8) * Math.PI * 2;
    const s = spokeColors[i];
    climbSpoke(out, {
      angle,
      rOuter: 22,
      rInner: 5,
      rTower: rTowerEdge,
      mergeY: 9.4,
      baseColor: s.base,
      topColor: s.top,
      flagColor: s.flag,
      marker: s.marker,
    });
  }

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
  // Half-grade cap, footprint matches the smaller wall dimension (1.3) so it
  // doesn't clip past the walls on either axis. Sits flush on the wall top.
  decoCone(out, -3, floatY + 2.325, -5, 1.3 * Math.SQRT2, 0.65, C.roofGold, { rotY: Math.PI / 4, segments: 4 });
  out.boxes.push({ x: -3, y: floatY + 2.325, z: -5, hx: 1.3, hy: 0.325, hz: 1.3 });
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
  // Half-grade cap, footprint matches the smaller wall dimension (1.3) so it
  // doesn't clip past the walls on either axis. Sits flush on the wall top.
  decoCone(out, 5, floatY2 + 2.325, 2, 1.3 * Math.SQRT2, 0.65, C.roofTeal, { rotY: Math.PI / 4, segments: 4 });
  out.boxes.push({ x: 5, y: floatY2 + 2.325, z: 2, hx: 1.3, hy: 0.325, hz: 1.3 });
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
  // Decorative roof, no collider — half-grade, flush with cap platform top (y=30)
  decoCone(out, wmCX, 30 + 0.4, wmCZ, 2.0, 0.8, C.roofGold, { rotY: Math.PI / 4, segments: 4 });
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

  // ── FIRST MOVING PLATFORM (vertical lift) ──
  // Player must time the boarding from the windmill cap.
  mover(out, {
    ax: 6, ay: 31, az: -4,
    bx: 1, by: 37, bz: 0,
    hx: 1.5, hy: 0.18, hz: 1.5,    // 3m × 3m × 0.36m
    period: 7, phase: 0,
    color: C.roofGold,
  });

  // The single cloud — landing pad after the first moving platform
  cloudPlatform(out, -1, 37, 2, 1.8);

  // ── PREPARATION PLATFORM ──
  // Stable 4m × 4m deck at y=39.5. Watch p1 (the shuttle) cycle from A→B→A,
  // and p2 (the wall) slide in and out, before committing.
  //   cloud (-1, 37, 2) → prep (0, 39.5, 4): 2.24m horiz, 2.5m up — EASY single jump
  solidBox(out, 0, 39.4, 4, 2.0, 0.1, 2.0, C.cobble, { rough: 0.85 });
  decoBox(out, 0, 39.55, 4, 2.05, 0.05, 2.05, C.cobbleEdge, { cast: false });
  // Small flag at the corner so it's visible from below
  decoCyl(out, 1.6, 40.5, 3.6, 0.04, 1.4, C.wood);
  decoBox(out, 1.95, 40.7, 3.6, 0.4, 0.3, 0.03, C.flag5);

  // ── SHUTTLE (p1) ──
  // Oscillates A=(0,40,6) ↔ B=(0,40,-8). Period 6s.
  //   prep edge (0, 39.5, 6) → p1 at A (0, 40, 6): 0m horiz, 0.5m up — TRIVIAL
  //   p1 at B (0, 40, -8) → destination (0, 40, -10): 2m flat — EASY
  mover(out, {
    ax: 0, ay: 40, az: 6,
    bx: 0, by: 40, bz: -8,
    hx: 1.5, hy: 0.18, hz: 1.5,
    period: 6, phase: 0,
    color: C.roofGold,
    kind: 'platform',
  });

  // ── BLOCKER WALL (p2) ──
  // Slides along x at z=-2 (the midpoint of p1's path). Period 12s = 2× p1's
  // period. OUT at x=-4 (clear), IN at x=0 (on p1's path).
  //
  //   t=0       p1 at A,   p2 at x=-4 (OUT)        ← SAFE BOARDING WINDOW
  //   t=1.5s    p1 mid fwd1, p2 at x=-3.41 (clear)
  //   t=3s      p1 at B,   p2 at x=-2  (halfway, near edge)
  //   t=4.5s    p1 mid back1, p2 at x=-0.59 (BLOCKING)
  //   t=6s      p1 at A,   p2 at x=0   (fully IN)  ← danger
  //   t=7.5s    p1 mid fwd2, p2 at x=-0.59 (BLOCKING)
  //   t=9s      p1 at B,   p2 at x=-2  (halfway)
  //   t=10.5s   p1 mid back2, p2 at x=-3.41 (clear) — back-from-B is safe!
  //   t=12s     p1 at A,   p2 at x=-4 (OUT) — cycle restarts
  //
  // Pattern: fwd1 SAFE / back1 BLOCKED / fwd2 BLOCKED / back2 SAFE.
  // Player should ONLY board at t=0, 12, 24, ... (every 12s).
  // Wall is tall enough that single-jumping over it is borderline; the
  // intended play is timing.
  mover(out, {
    ax: -4, ay: 41, az: -2,
    bx:  0, by: 41, bz: -2,
    hx: 2.0, hy: 1.4, hz: 0.4,     // 4m wide × 2.8m tall × 0.8m thick
    period: 12, phase: 0,
    color: '#dc2626',               // visceral red
    kind: 'wall',
  });
  // Decorative spikes on the wall — visual hazard cue
  // (rendered statically along the wall length; they shift with the wall via MoverNode)

  // ── DESTINATION PLATFORM ──
  solidBox(out, 0, 39.9, -10, 1.6, 0.1, 1.6, C.cobble, { rough: 0.85 });
  decoBox(out, 0, 40.05, -10, 1.65, 0.05, 1.65, C.cobbleEdge, { cast: false });

  // ── Crystal spires up to the goal ──
  // From destination platform (0, 40, -10):
  //   → crystal 1 cap y=42:   1.5m horiz, 2m up — EASY
  //   → crystal 2 cap y=43:   2.3m horiz, 1m up — EASY
  //   → crystal 3 cap y=44:   2.0m horiz, 1m up — EASY
  //   → goal pad:             1.5m horiz, 0.5m up — TRIVIAL
  crystal(out, -1.5, 40.5, -11.5, 1.5);
  crystal(out,  1,   41.5, -12,   1.5);
  crystal(out, -1,   42.5, -12.5, 1.5);

  // ── Final goal pad and orb ──
  const goalY = 44.5;
  solidBox(out, 0, goalY - 0.3, -13, 1.6, 0.2, 1.6, C.crystalA);
  decoCone(out, 0, goalY - 0.75, -13, 1.8, 0.7, C.crystalA, { rotY: 0, segments: 8 });
  out.goal = { x: 0, y: goalY + 0.6, z: -13 };

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
