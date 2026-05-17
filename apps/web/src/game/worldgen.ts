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

export type WorldData = {
  boxes: Box[];
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

/** A decorative cottage. Walls + pyramid roof are solid colliders; player
 *  walks around them, never on top. Has door, glowing window(s), chimney
 *  with smoke, and an optional little garden patch out front. */
function cottage(out: WorldData, opts: CottageOpts) {
  const { cx, cz, baseY, wallW, wallD, wallH, roofH, wallColor, roofColor } = opts;
  const wallCY = baseY + wallH / 2;
  const wallTop = baseY + wallH;

  // Walls
  solidBox(out, cx, wallCY, cz, wallW / 2, wallH / 2, wallD / 2, wallColor, { rough: 0.9 });

  // Decorative trim board around the wall top
  decoBox(out, cx, wallTop + 0.05, cz, wallW / 2 + 0.1, 0.06, wallD / 2 + 0.1, C.woodLight, { rough: 0.9 });

  // Pyramid roof — solid collider so the player can't pass through it;
  // its bounding AABB just covers the cottage footprint.
  const roofR = Math.max(wallW, wallD) / 2;
  const roofCY = wallTop + 0.12 + roofH / 2;
  // visual
  decoCone(out, cx, roofCY, cz, roofR * Math.SQRT2, roofH, roofColor, { rotY: Math.PI / 4, segments: 4 });
  // collider — bounding AABB of the pyramid base
  out.boxes.push({ x: cx, y: roofCY, z: cz, hx: roofR, hy: roofH / 2, hz: roofR });

  // Chimney + animated smoke puff
  const chX = cx + wallW / 4;
  const chZ = cz - wallD / 4;
  const chY = wallTop + 0.5;
  decoBox(out, chX, chY, chZ, 0.22, 0.6, 0.22, '#7f1d1d');
  decoBox(out, chX, chY + 0.62, chZ, 0.27, 0.05, 0.27, '#451a03');
  out.smoke.push({ x: chX, y: chY + 1.2, z: chZ });

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

function ladder(out: WorldData, opts: {
  anchorX: number; anchorZ: number;
  faceNormalX: number; faceNormalZ: number;
  baseY: number; topY: number;
  width: number;
}) {
  const perp: [number, number] = [-opts.faceNormalZ, opts.faceNormalX];
  const dy = 0.7;
  const rungs = Math.max(2, Math.floor((opts.topY - opts.baseY) / dy));
  for (const sign of [1, -1] as const) {
    const fx = opts.anchorX + perp[0] * (opts.width / 2) * sign + opts.faceNormalX * 0.06;
    const fz = opts.anchorZ + perp[1] * (opts.width / 2) * sign + opts.faceNormalZ * 0.06;
    decoCyl(out, fx, (opts.baseY + opts.topY) / 2, fz, 0.04, opts.topY - opts.baseY + 0.2, C.wood);
  }
  for (let i = 1; i <= rungs; i++) {
    const y = opts.baseY + i * dy;
    const cx = opts.anchorX + opts.faceNormalX * 0.18;
    const cz = opts.anchorZ + opts.faceNormalZ * 0.18;
    const hx = Math.abs(opts.faceNormalX) > 0.5 ? 0.15 : opts.width / 2;
    const hz = Math.abs(opts.faceNormalZ) > 0.5 ? 0.15 : opts.width / 2;
    solidBox(out, cx, y, cz, hx, 0.05, hz, C.woodLight, { rough: 0.9 });
  }
}

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
  // cylindrical AABB block (approximation) so player can lean against it
  out.boxes.push({ x: cx, y: baseY + 0.4, z: cz, hx: rimR * 0.75, hy: 0.4, hz: rimR * 0.75 });
  // dark water disc
  decoCyl(out, cx, baseY + 0.6, cz, rimR * 0.7, 0.04, C.water, { segments: 18, emissive: '#1e3a8a', emissiveIntensity: 0.15 });
  // roof posts
  for (const [sx, sz] of [[-rimR * 0.8, -rimR * 0.8], [rimR * 0.8, -rimR * 0.8], [-rimR * 0.8, rimR * 0.8], [rimR * 0.8, rimR * 0.8]] as const) {
    decoCyl(out, cx + sx, baseY + 1.6, cz + sz, 0.07, 2.0, C.wood);
  }
  // pyramid roof
  decoCone(out, cx, baseY + 3.0, cz, rimR * 1.4, 0.9, C.roofRed, { rotY: Math.PI / 4, segments: 4 });
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
  decoCone(out, x, baseY + height / 2, z, 0.7, height, c, { segments: 6 });
  decoCone(out, x, baseY + height / 2 + 0.4, z, 0.4, height * 0.4, C.crystalB, { segments: 6 });
  solidBox(out, x, baseY + height + 0.05, z, 0.45, 0.05, 0.45, C.crystalC, { rough: 0.3 });
}

// ────────────────────── features: climbable structures ──────────────────────

/** Central spiral staircase tower. Climb route #1. */
function spiralTower(out: WorldData, cx: number, cz: number, baseY: number, topY: number) {
  const tR = 1.8;
  const totalH = topY - baseY;
  // Body
  decoCyl(out, cx, baseY + totalH / 2, cz, tR, totalH, C.cobble, { segments: 22 });
  solidBox(out, cx, baseY + totalH / 2, cz, tR * 0.78, totalH / 2, tR * 0.78, C.cobble);
  // Wider spiral
  const steps = 22;
  const stepRise = totalH / steps;
  const turns = 2.8;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const sR = tR + 1.05;
    const sx = cx + Math.cos(a) * sR;
    const sz = cz + Math.sin(a) * sR;
    const sy = baseY + (i + 0.5) * stepRise;
    const halfY = stepRise / 2 + 0.04;
    const color = i % 2 === 0 ? C.wood : C.woodLight;
    solidBox(out, sx, sy, sz, 0.7, halfY, 0.7, color, { rotY: -a, rough: 0.85 });
    decoCyl(out, sx + Math.cos(a) * 0.7, sy + halfY + 0.35, sz + Math.sin(a) * 0.7, 0.04, 0.7, C.wood);
  }
  // Bigger top platform with battlement-style edge
  const topPlatHx = tR + 2.2;
  solidBox(out, cx, topY + 0.2, cz, topPlatHx, 0.2, topPlatHx, C.cobble);
  decoBox(out, cx, topY + 0.35, cz, topPlatHx + 0.05, 0.1, topPlatHx + 0.05, C.cobbleEdge, { cast: false });
  // Crenellations around the top
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    decoBox(out, cx + Math.cos(a) * topPlatHx * 0.95, topY + 0.55, cz + Math.sin(a) * topPlatHx * 0.95, 0.18, 0.2, 0.18, C.cobbleEdge, { rotY: -a });
  }
  // Small, centered roof spire (NOT covering the whole platform)
  const spireR = 1.0;
  const spireH = 1.8;
  decoCone(out, cx, topY + 0.4 + spireH / 2, cz, spireR * Math.SQRT2, spireH, C.roofPlum, { rotY: Math.PI / 4, segments: 4 });
  // Collider for the spire so player can't walk into it
  out.boxes.push({ x: cx, y: topY + 0.4 + spireH / 2, z: cz, hx: spireR, hy: spireH / 2, hz: spireR });
  // A flag on top
  decoCyl(out, cx, topY + 0.4 + spireH + 0.6, cz, 0.05, 1.2, C.wood);
}

/** Square stone tower with exterior wooden stairs. Climb route #2. */
function outerScaffold(out: WorldData, cx: number, cz: number, topY: number, color = C.cobble) {
  const tw = 2.2;
  const totalH = topY;
  decoBox(out, cx, totalH / 2, cz, tw, totalH / 2, tw, color, { rough: 0.95, cast: true });
  out.boxes.push({ x: cx, y: totalH / 2, z: cz, hx: tw * 0.9, hy: totalH / 2, hz: tw * 0.9 });
  const steps = Math.floor(totalH / 0.85);
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 2 + 0.4;
    const r = tw + 0.5;
    const sx = cx + Math.cos(a) * r;
    const sz = cz + Math.sin(a) * r;
    const sy = 0.5 + i * 0.85;
    solidBox(out, sx, sy, sz, 0.7, 0.14, 0.7, C.wood, { rough: 0.85 });
    decoCyl(out, sx, sy + 0.42, sz, 0.04, 0.8, C.wood);
  }
  solidBox(out, cx, topY + 0.2, cz, tw + 0.8, 0.2, tw + 0.8, C.cobbleEdge);
  decoCone(out, cx, topY + 0.4 + 0.9, cz, tw + 1.0, 1.8, C.roofCoral, { rotY: Math.PI / 4, segments: 4 });
  out.boxes.push({ x: cx, y: topY + 0.4 + 0.9, z: cz, hx: tw + 1.0, hy: 0.9, hz: tw + 1.0 });
  decoBox(out, cx, totalH * 0.55, cz + tw + 0.01, 0.35, 0.3, 0.04, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.55 });
  decoBox(out, cx, totalH * 0.55, cz + tw + 0.01, 0.4, 0.35, 0.05, C.windowFrame);
}

/** Wooden watchtower — 4 corner posts with ladder up to a lookout platform. Climb route #4. */
function watchtower(out: WorldData, cx: number, cz: number, topY: number) {
  const w = 1.4; // half-extent of the tower footprint
  // 4 corner posts (visual + each a slim collider so you can't pass through)
  const postHy = topY / 2;
  for (const [sx, sz] of [[-w, -w], [w, -w], [-w, w], [w, w]] as const) {
    decoCyl(out, cx + sx, postHy, cz + sz, 0.12, topY, C.wood);
    out.boxes.push({ x: cx + sx, y: postHy, z: cz + sz, hx: 0.12, hy: postHy, hz: 0.12 });
  }
  // Cross-braces (decorative)
  for (const side of [[-w, 0, 1, 0], [w, 0, 1, 0], [0, -w, 0, 1], [0, w, 0, 1]] as const) {
    // visual diagonal beam
    decoBox(out, cx + side[0], topY * 0.4, cz + side[1], 0.05, 0.6, 0.05, C.wood, { rotY: side[2] === 1 ? 0.6 : -0.6 });
  }
  // Ladder rungs up one side (each rung is a small platform you can land on)
  for (let i = 0; i < Math.floor(topY / 0.7); i++) {
    const y = 0.6 + i * 0.7;
    if (y > topY - 0.4) break;
    solidBox(out, cx, y, cz + w + 0.15, 0.4, 0.05, 0.15, C.woodLight, { rough: 0.9 });
  }
  // Top lookout platform — a wide square
  solidBox(out, cx, topY + 0.1, cz, w + 0.6, 0.1, w + 0.6, C.plank, { rough: 0.85 });
  // Low railing posts
  for (const [sx, sz] of [[-w, -w], [w, -w], [-w, w], [w, w]] as const) {
    decoCyl(out, cx + sx, topY + 0.5, cz + sz, 0.05, 0.8, C.wood);
  }
  // Conical wooden roof
  decoCone(out, cx, topY + 1.4, cz, w + 1.0, 1.8, C.roofForest, { rotY: Math.PI / 4, segments: 4 });
  out.boxes.push({ x: cx, y: topY + 1.4, z: cz, hx: w + 0.4, hy: 0.9, hz: w + 0.4 });
  // Watch-fire on top of roof
  decoCone(out, cx, topY + 2.5, cz, 0.2, 0.4, C.lanternGlow, { segments: 6 });
}

/** Tavern — wider 2-story building with stairs leading up to a balcony, then roof platform. Climb route #5. */
function tavern(out: WorldData, cx: number, cz: number, baseY = 0) {
  const w = 4, d = 3.5, h1 = 2.6;
  // First-floor walls
  solidBox(out, cx, baseY + h1 / 2, cz, w / 2, h1 / 2, d / 2, C.wallCream, { rough: 0.9 });
  decoBox(out, cx, baseY + h1 + 0.05, cz, w / 2 + 0.1, 0.06, d / 2 + 0.1, C.wood, { cast: false });
  // Second-floor (narrower) walls
  const h2 = 1.8;
  solidBox(out, cx, baseY + h1 + 0.12 + h2 / 2, cz, w / 2 - 0.3, h2 / 2, d / 2 - 0.3, C.wallOlive, { rough: 0.9 });
  // Pyramid roof on top — solid collider
  const roofR = w / 2 - 0.3;
  const roofH = 1.6;
  const roofCY = baseY + h1 + 0.12 + h2 + 0.12 + roofH / 2;
  decoCone(out, cx, roofCY, cz, roofR * Math.SQRT2, roofH, C.roofRed, { rotY: Math.PI / 4, segments: 4 });
  out.boxes.push({ x: cx, y: roofCY, z: cz, hx: roofR, hy: roofH / 2, hz: roofR });
  // External stairs on the +z side up to a balcony at h1 height
  stairFlight(out, {
    startX: cx - w / 2 - 0.2, startZ: cz + d / 2 + 0.4,
    dirX: 1, dirZ: 0,
    steps: 5, stepRise: (h1 + 0.18) / 5, stepRun: 0.6, width: 1.2,
    color: C.wood, railColor: C.woodDark,
  });
  // Balcony deck along the +z side connecting the stair top to the next set of stairs going up
  solidBox(out, cx, baseY + h1 + 0.18, cz + d / 2 + 0.8, w / 2 + 0.3, 0.08, 0.6, C.plank);
  // 2nd flight of stairs ascending the balcony to the roof platform
  stairFlight(out, {
    startX: cx + w / 2 + 0.2, startZ: cz + d / 2 + 0.8,
    dirX: 0, dirZ: -1,
    steps: 4, stepRise: (h2 + 0.2) / 4, stepRun: 0.5, width: 1.0,
    color: C.wood, railColor: C.woodDark,
  });
  // The 2nd floor balcony / walkable mid-roof on east side
  solidBox(out, cx + w / 2 + 0.4, baseY + h1 + 0.18 + h2 + 0.2, cz, 0.4, 0.08, d / 2 - 0.3, C.plank);
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
    meshes: [],
    windmills: [],
    flags: [],
    smoke: [],
    goal: { x: 0, y: 0, z: 0 },
    maxHeight: 0,
  };

  // ── ground (doubled) ──
  solidBox(out, 0, -0.5, 0, 60, 0.5, 60, C.grass, { rough: 1, receive: true });
  // grass tone variations scattered for visual interest
  for (let i = 0; i < 40; i++) {
    const ax = (rng() * 2 - 1) * 55;
    const az = (rng() * 2 - 1) * 55;
    decoBox(out, ax, 0.015, az, 0.6 + rng() * 0.8, 0.015, 0.6 + rng() * 0.8, rng() > 0.5 ? C.grassDark : C.grassDeep, { cast: false });
  }
  // Central cobblestone plaza
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const a = (i - 3.5) * 1.0;
      const b = (j - 3.5) * 1.0;
      // skip the very center (well goes there)
      if (Math.abs(a) < 1.5 && Math.abs(b) < 1.5) continue;
      const shade = 0.85 + rng() * 0.25;
      pathTile(out, a, b, shade);
    }
  }

  // Well in plaza
  well(out, 0, 0, 0);

  // Path pavers radiating out toward 6 cottages + 2 outer structures + 2 climbing structures
  const radials: [number, number][] = [
    [-18, -18], [18, -18], [-18, 18], [18, 18],   // 4 corner cottages
    [0, -22], [0, 22],                              // 2 side cottages
    [-25, 0], [25, 0],                              // climbing tree + outer scaffold
    [0, -30], [0, 30],                              // watchtower + tavern
  ];
  for (const [tx, tz] of radials) {
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sx = tx * t * 0.7;
      const sz = tz * t * 0.7;
      pathTile(out, sx, sz, 0.95);
    }
  }

  // ── 6 decorative cottages around the village ──
  type Cottage = {
    cx: number; cz: number;
    wall: string; roof: string;
    door: 'north' | 'south' | 'east' | 'west';
    garden?: boolean;
  };
  const cottages: Cottage[] = [
    { cx: -18, cz:  18, wall: C.wallCream, roof: C.roofRed,    door: 'east',  garden: true  },
    { cx:  18, cz:  18, wall: C.wallMint,  roof: C.roofTeal,   door: 'west',  garden: true  },
    { cx: -18, cz: -18, wall: C.wallPink,  roof: C.roofLav,    door: 'east'                 },
    { cx:  18, cz: -18, wall: C.wallSky,   roof: C.roofCoral,  door: 'west',  garden: true  },
    { cx:   0, cz:  22, wall: C.wallPeach, roof: C.roofBlue,   door: 'south', garden: true  },
    { cx:   0, cz: -22, wall: C.wallLav,   roof: C.roofGold,   door: 'north'                },
  ];
  for (const c of cottages) {
    cottage(out, {
      cx: c.cx, cz: c.cz, baseY: 0,
      wallW: 5, wallD: 4, wallH: 3, roofH: 1.7,
      wallColor: c.wall, roofColor: c.roof,
      doorFace: c.door,
      hasGarden: c.garden,
    });
  }

  // ── Fences around the cottage gardens (visual flavor) ──
  // Outer perimeter fence: 4 sides with gaps near each climbing structure
  const fenceR = 36;
  const gaps = [Math.PI / 2, -Math.PI / 2, 0, Math.PI]; // N, S, E, W gaps
  for (let i = 0; i < 48; i++) {
    const a1 = (i / 48) * Math.PI * 2;
    const a2 = ((i + 1) / 48) * Math.PI * 2;
    // skip near gaps
    let nearGap = false;
    for (const g of gaps) {
      let d = Math.abs(((a1 + a2) / 2) - g);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < 0.2) nearGap = true;
    }
    if (nearGap) continue;
    fenceSegment(out, Math.cos(a1) * fenceR, Math.sin(a1) * fenceR, Math.cos(a2) * fenceR, Math.sin(a2) * fenceR);
  }

  // ── 5 climbing routes converging at central tower top (y=9) ──

  // 1. Central spiral staircase tower
  const towerTopY = 9;
  spiralTower(out, 0, 0, 0, towerTopY);
  out.flags.push({ x: 0, y: towerTopY + 2.4, z: 0, rotY: 0, color: C.flag1 });

  // 2. East stone tower with wooden stairs
  outerScaffold(out, 26, 0, 9, C.cobble);
  out.flags.push({ x: 26, y: 9 + 2.3, z: 0, rotY: Math.PI / 2, color: C.flag2 });
  // Bridge across to the central tower top
  bridge(out, 26 - 3.0, 0, 0 + 4.0, 0, 9.4);

  // 3. West climbing tree
  climbingTree(out, -26, 0, 8);
  bridge(out, -26 + 0.6, 0, -4.0, 0, 8.6);

  // 4. North watchtower (ladder rungs up a 4-post wooden frame)
  watchtower(out, 0, -32, 9.5);
  bridge(out, 0, -32 + 2.0, 0, -4.0, 9.6);
  out.flags.push({ x: 0, y: 9.5 + 2.7, z: -32, rotY: 0, color: C.flag4 });

  // 5. South tavern (2-story building with external stairs to roof)
  tavern(out, 0, 28);
  out.flags.push({ x: -2, y: 2.6 + 0.5, z: 28 - 1.7, rotY: 0, color: C.flag3 });
  // Bridge from tavern's upper balcony to central tower top
  // tavern east balcony center: x=cx+w/2+0.4=2.4, y=h1+h2+0.38=4.78, z=cz=28
  // We want a bridge from the tavern's TOP (the upper-floor walkable spot) up to the central tower
  // The tavern's top reachable point is the balcony at y=4.78. From there, an aerial walkway
  // climbs to the central tower top (y=9.4). Use stepping platforms.
  platform(out,  3.0, 6.5, 23, 1.0, 1.0, C.dirt, C.grassDeep);
  platform(out,  2.0, 8.5, 16, 1.0, 1.0, C.dirt, C.grassDeep);
  bridge(out, 2.0, 11, 0, 4.0, 9.4);

  // ── crate ladder up the east side (extra small route from ground near outer tower) ──
  solidBox(out, 21, 1.2, -2, 0.7, 0.3, 0.7, C.wood);
  solidBox(out, 23, 2.5, -1, 0.8, 0.3, 0.8, C.wood);
  solidBox(out, 24, 4.0,  1, 0.9, 0.3, 0.9, C.wood);

  // ── peripheral trees (varied: regular, blossom, pine) ──
  const treePositions: Array<{ x: number; z: number; kind: 'tree' | 'pine' | 'blossom'; size: number }> = [
    { x: -30, z:  22, kind: 'blossom', size: 4 },
    { x:  30, z:  22, kind: 'tree',    size: 5 },
    { x: -30, z: -22, kind: 'pine',    size: 6 },
    { x:  30, z: -22, kind: 'tree',    size: 5 },
    { x:   8, z:  30, kind: 'blossom', size: 3.5 },
    { x:  -8, z:  30, kind: 'blossom', size: 4 },
    { x:  14, z: -28, kind: 'tree',    size: 4 },
    { x: -14, z: -28, kind: 'pine',    size: 5 },
    { x:   0, z:  38, kind: 'pine',    size: 6 },
    { x:  38, z:   0, kind: 'pine',    size: 6 },
    { x: -38, z:   8, kind: 'tree',    size: 5 },
    { x: -38, z: -10, kind: 'blossom', size: 4 },
    { x:  38, z:  10, kind: 'tree',    size: 5 },
    { x:  10, z:  12, kind: 'blossom', size: 3 },
    { x: -10, z:  12, kind: 'tree',    size: 4 },
    { x: -10, z: -12, kind: 'blossom', size: 3 },
    { x:  10, z: -12, kind: 'pine',    size: 4 },
  ];
  for (const t of treePositions) {
    if (t.kind === 'tree') tree(out, { x: t.x, z: t.z, height: t.size });
    else if (t.kind === 'pine') pineTree(out, t.x, t.z, t.size);
    else blossomTree(out, t.x, t.z, t.size);
  }

  // ── lanterns along the paths ──
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    lantern(out, Math.cos(ang) * 8, 0, Math.sin(ang) * 8, 2.2);
  }
  // 4 taller plaza lanterns
  for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]] as const) {
    lantern(out, lx, 0, lz, 2.6);
  }

  // ── mushrooms scattered widely ──
  for (let i = 0; i < 40; i++) {
    const ang = rng() * Math.PI * 2;
    const r = 14 + rng() * 30;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const c: 'red' | 'purple' | 'blue' = rng() > 0.7 ? 'purple' : rng() > 0.5 ? 'blue' : 'red';
    mushroom(out, x, z, 0.6 + rng() * 0.7, c);
  }
  // ── flower patches ──
  for (let i = 0; i < 30; i++) {
    const ang = rng() * Math.PI * 2;
    const r = 8 + rng() * 30;
    flowerPatch(out, Math.cos(ang) * r, Math.sin(ang) * r, 5 + Math.floor(rng() * 5), rng);
  }

  // ── village clutter: barrels, hay, benches, signs ──
  // barrels near tavern
  barrel(out, -3, 28 + 1.5);
  barrel(out, -3.5, 28 + 2.2);
  barrel(out, 3.2, 28 + 1.5);
  // hay near watchtower
  haystack(out, 2.5, -32 - 1.0);
  haystack(out, 3.2, -32 + 1.5);
  haystack(out, -2.8, -32 - 2.0);
  // benches in plaza
  bench(out, -4, 4, Math.PI / 4);
  bench(out, 4, -4, -Math.PI / 4);
  bench(out, -4, -4, -Math.PI / 4);
  // signs on the paths
  sign(out, -8, -8, Math.PI / 4, C.wallOlive);
  sign(out, 8, 8, -Math.PI * 3 / 4, C.wallPeach);
  sign(out, -16, 0, Math.PI / 2, C.wallMint);
  sign(out, 16, 0, -Math.PI / 2, C.wallSky);
  // flags atop each cottage roof
  for (const c of cottages) {
    out.flags.push({ x: c.cx, y: 5.2, z: c.cz, rotY: 0, color: [C.flag1, C.flag2, C.flag3, C.flag4, C.flag5][Math.floor(rng() * 5)] });
  }

  // ── above the tower: stepping stones rising ──
  let y = towerTopY + 2.0;          // 11.0
  platform(out,  4.5, y, -0.5, 1.0, 1.0, C.dirt, C.grassDeep);
  y += 2.1;                          // 13.1
  platform(out, -3.5, y,  2.0, 1.0, 1.0, C.dirt, C.grassDeep);
  y += 2.1;                          // 15.2
  platform(out,  2.0, y,  4.0, 1.0, 1.0, C.dirt, C.grassDeep);
  y += 2.1;                          // 17.3
  platform(out, -4.0, y, -1.0, 1.2, 1.2, C.dirt, C.grassDeep);

  // Floating cottage 1 (lavender)
  const floatY = 18;
  // small floating cottage uses old floatingCottage-style inline
  solidBox(out, -3, floatY - 0.1, -5, 2.1, 0.1, 1.9, C.grassDeep);
  decoBox(out, -3, floatY - 0.02, -5, 2.15, 0.04, 1.95, C.grass, { cast: false });
  solidBox(out, -3, floatY + 0.9, -5, 1.5, 0.9, 1.3, C.wallLav);
  solidBox(out, -3, floatY + 1.9, -5, 1.55, 0.1, 1.35, '#9ca3af');
  decoCone(out, -3, floatY + 2.85, -5, 1.55 * Math.SQRT2, 1.3, C.roofGold, { rotY: Math.PI / 4, segments: 4 });
  out.boxes.push({ x: -3, y: floatY + 2.85, z: -5, hx: 1.55, hy: 0.65, hz: 1.55 });
  decoBox(out, -3.5, floatY + 1.1, -3.99, 0.3, 0.25, 0.04, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.7 });
  out.smoke.push({ x: -2.4, y: floatY + 2.3, z: -5.5 });
  decoBox(out, -2.4, floatY + 2.3, -5.5, 0.18, 0.5, 0.18, '#7f1d1d');

  // Aerial planks from stepper #4 to the floating cottage
  bridge(out, -4.0, -1.0, -3.0, -3.0, 17.9);

  // Floating cottage 2 (cream + teal)
  const floatY2 = 21;
  solidBox(out, 5, floatY2 - 0.1, 2, 2.1, 0.1, 1.9, C.grassDeep);
  decoBox(out, 5, floatY2 - 0.02, 2, 2.15, 0.04, 1.95, C.grass, { cast: false });
  solidBox(out, 5, floatY2 + 0.9, 2, 1.5, 0.9, 1.3, C.wallCream);
  solidBox(out, 5, floatY2 + 1.9, 2, 1.55, 0.1, 1.35, '#9ca3af');
  decoCone(out, 5, floatY2 + 2.85, 2, 1.55 * Math.SQRT2, 1.3, C.roofTeal, { rotY: Math.PI / 4, segments: 4 });
  out.boxes.push({ x: 5, y: floatY2 + 2.85, z: 2, hx: 1.55, hy: 0.65, hz: 1.55 });
  decoBox(out, 5, floatY2 + 1.1, 3.01, 0.3, 0.25, 0.04, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.7 });
  out.smoke.push({ x: 5.5, y: floatY2 + 2.3, z: 1.5 });
  decoBox(out, 5.5, floatY2 + 2.3, 1.5, 0.18, 0.5, 0.18, '#7f1d1d');

  bridge(out, -3 + 1.6, -5 + 1.4, 5 - 1.6, 2 - 1.4, 20.5);

  // ── windmill tower ──
  const wmBaseY = 23;
  const wmTowerH = 6.5;
  const wmCX = 10;
  const wmCZ = -6;
  decoCyl(out, wmCX, wmBaseY + wmTowerH / 2, wmCZ, 0.9, wmTowerH, C.cobble, { segments: 14 });
  solidBox(out, wmCX, wmBaseY + wmTowerH / 2, wmCZ, 0.7, wmTowerH / 2, 0.7, C.cobble);
  solidBox(out, wmCX, wmBaseY + wmTowerH + 0.2, wmCZ, 1.6, 0.2, 1.6, C.cobbleEdge);
  decoCone(out, wmCX, wmBaseY + wmTowerH + 0.4 + 0.8, wmCZ, 2.0, 1.6, C.roofGold, { rotY: Math.PI / 4, segments: 4 });
  out.windmills.push({ x: wmCX, y: wmBaseY + wmTowerH * 0.7, z: wmCZ + 0.85, rotY: 0 });
  for (let i = 0; i < 9; i++) {
    const ry = wmBaseY + 0.5 + i * 0.75;
    solidBox(out, wmCX, ry, wmCZ + 1.0, 0.5, 0.05, 0.15, C.wood);
  }
  decoCyl(out, wmCX - 0.45, wmBaseY + wmTowerH / 2, wmCZ + 1.05, 0.04, wmTowerH, C.wood);
  decoCyl(out, wmCX + 0.45, wmBaseY + wmTowerH / 2, wmCZ + 1.05, 0.04, wmTowerH, C.wood);
  bridge(out, 5 + 1.6, 2 - 1.4, wmCX - 0.9, wmCZ + 0.5, 23.2);

  // ── above windmill: cloud staircase ──
  const wmTop = wmBaseY + wmTowerH + 0.4;
  let cy = wmTop + 2.0;
  cloudPlatform(out,  6, cy, -3, 1.9);
  cy += 2.1;
  cloudPlatform(out, -1, cy, -2, 1.7);
  cy += 2.1;
  cloudPlatform(out, -5, cy,  4, 1.6);
  cy += 2.1;
  cloudPlatform(out,  2, cy,  6, 1.6);

  // ── crystal spires + goal ──
  const cyTop = cy + 2.3;
  crystal(out, -2, cyTop,         -2, 2.0);
  crystal(out,  3, cyTop + 1.2,    1, 2.0);
  crystal(out, -1, cyTop + 2.5,    3, 2.0);
  const goalY = cyTop + 4.5;
  solidBox(out, 0, goalY - 0.4, 0, 1.6, 0.2, 1.6, C.crystalA);
  decoCone(out, 0, goalY - 0.85, 0, 1.8, 0.7, C.crystalA, { rotY: 0, segments: 8 });
  out.goal = { x: 0, y: goalY + 0.6, z: 0 };

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
