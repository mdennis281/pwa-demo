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
  grass: '#86efac',
  grassDeep: '#4ade80',
  grassDark: '#16a34a',
  dirt: '#a16207',
  cobble: '#94a3b8',
  cobbleEdge: '#475569',
  wood: '#92400e',
  woodLight: '#c2410c',
  plank: '#a16207',

  wallCream: '#fef3c7',
  wallMint: '#a7f3d0',
  wallPink: '#fbcfe8',
  wallSky: '#bae6fd',
  wallLav: '#ddd6fe',

  roofRed: '#dc2626',
  roofTeal: '#0d9488',
  roofCoral: '#fb923c',
  roofLav: '#7c3aed',
  roofPlum: '#a21caf',
  roofGold: '#ca8a04',

  treeTrunk: '#78350f',
  treeFol: '#16a34a',
  treeFol2: '#22c55e',

  lanternGlow: '#fbbf24',
  lanternBody: '#7c2d12',

  mushCap: '#dc2626',
  mushCapPurple: '#9333ea',
  mushStem: '#fef3c7',

  cloud: '#f8fafc',
  cloudEdge: '#e2e8f0',

  crystalA: '#a78bfa',
  crystalB: '#c4b5fd',
  crystalC: '#7dd3fc',

  doorBrown: '#7c2d12',
  windowGlow: '#fde68a',
  windowFrame: '#78350f',

  flag1: '#ef4444',
  flag2: '#3b82f6',
  flag3: '#facc15',

  smoke: '#cbd5e1',

  metal: '#475569',
  metalLight: '#94a3b8',
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

// ────────────────────── features ──────────────────────

type HouseOpts = {
  cx: number; cz: number; baseY: number;
  wallW: number; wallD: number; wallH: number;
  roofH: number;
  wallColor: string; roofColor: string;
  doorFace: 'north' | 'south' | 'east' | 'west';
  windowFace: 'north' | 'south' | 'east' | 'west';
  /** which side the climbing route is on */
  climbFace: 'north' | 'south' | 'east' | 'west';
  /** stairs or ladder */
  climbKind: 'stair' | 'ladder';
  chimneyOffset?: [number, number];
};

function faceNormal(face: HouseOpts['doorFace']): [number, number] {
  switch (face) {
    case 'north': return [0, -1];
    case 'south': return [0, 1];
    case 'east':  return [1, 0];
    case 'west':  return [-1, 0];
  }
}

function house(out: WorldData, opts: HouseOpts) {
  const { cx, cz, baseY, wallW, wallD, wallH, roofH, wallColor, roofColor } = opts;
  const wallCY = baseY + wallH / 2;
  const wallTop = baseY + wallH;

  // Walls (single solid box for physics + visual)
  solidBox(out, cx, wallCY, cz, wallW / 2, wallH / 2, wallD / 2, wallColor);

  // Roof platform (walkable, just above wall top — barely above, lets player stand)
  const roofPlatformHy = 0.15;
  const roofPlatformY = wallTop + roofPlatformHy;
  solidBox(out, cx, roofPlatformY, cz, wallW / 2 + 0.05, roofPlatformHy, wallD / 2 + 0.05, '#9ca3af', { rough: 0.7 });

  // Decorative pitched roof (4-sided pyramid via cone with 4 segments)
  const roofR = Math.max(wallW, wallD) / 2 + 0.1;
  const roofCY = roofPlatformY + roofPlatformHy + roofH / 2 + 0.02;
  decoCone(out, cx, roofCY, cz, roofR * Math.SQRT2, roofH, roofColor, { rotY: Math.PI / 4, segments: 4 });

  // Chimney
  const [ox, oz] = opts.chimneyOffset ?? [wallW / 4, -wallD / 4];
  const chimX = cx + ox;
  const chimZ = cz + oz;
  const chimY = roofPlatformY + roofPlatformHy + 0.6;
  decoBox(out, chimX, chimY, chimZ, 0.18, 0.6, 0.18, '#7f1d1d', { rough: 0.9 });
  decoBox(out, chimX, chimY + 0.65, chimZ, 0.22, 0.06, 0.22, '#451a03'); // cap
  out.smoke.push({ x: chimX, y: chimY + 1.2, z: chimZ });

  // Door
  const [dnx, dnz] = faceNormal(opts.doorFace);
  const doorX = cx + dnx * (wallD * (dnx === 0 ? 0 : 0) + wallW / 2 * Math.abs(dnx)) + dnx * 0.02;
  const doorZ = cz + dnz * (wallD / 2 * Math.abs(dnz)) + dnz * 0.02;
  // door is on the +x/-x face: offset along x; on +z/-z face: offset along z.
  // recompute precisely:
  const onZFace = Math.abs(dnz) > 0;
  const dx = onZFace ? 0 : dnx * (wallW / 2 + 0.01);
  const dz = onZFace ? dnz * (wallD / 2 + 0.01) : 0;
  decoBox(out, cx + dx, baseY + 0.65, cz + dz, onZFace ? 0.3 : 0.05, 0.65, onZFace ? 0.05 : 0.3, C.doorBrown, { rough: 0.85 });
  decoBox(out, cx + dx * 1.05, baseY + 0.6, cz + dz * 1.05, onZFace ? 0.05 : 0.02, 0.05, onZFace ? 0.02 : 0.05, '#fbbf24'); // handle

  // Window
  const [wnx, wnz] = faceNormal(opts.windowFace);
  const onZFaceW = Math.abs(wnz) > 0;
  const wx = onZFaceW ? wallW / 4 : wnx * (wallW / 2 + 0.01);
  const wz = onZFaceW ? wnz * (wallD / 2 + 0.01) : wallD / 4;
  decoBox(out, cx + wx, baseY + wallH * 0.62, cz + wz, onZFaceW ? 0.35 : 0.04, 0.3, onZFaceW ? 0.04 : 0.35, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.55 });
  decoBox(out, cx + wx, baseY + wallH * 0.62, cz + wz, onZFaceW ? 0.4 : 0.05, 0.35, onZFaceW ? 0.05 : 0.4, C.windowFrame); // frame

  // Climb route — stair or ladder up to roof platform
  const [cnx, cnz] = faceNormal(opts.climbFace);
  if (opts.climbKind === 'stair') {
    stairFlight(out, {
      startX: cx + cnx * (wallW / 2 + 0.1),
      startZ: cz + cnz * (wallD / 2 + 0.1),
      dirX: cnx,
      dirZ: cnz,
      steps: 4,
      stepRise: wallH / 4 + 0.05,
      stepRun: 0.55,
      width: 1.2,
      color: C.wood,
      sideColor: C.woodLight,
    });
  } else {
    ladder(out, {
      anchorX: cx + cnx * (wallW / 2 + 0.05),
      anchorZ: cz + cnz * (wallD / 2 + 0.05),
      faceNormalX: cnx,
      faceNormalZ: cnz,
      baseY,
      topY: wallTop + 0.1,
      width: 0.9,
    });
  }
}

type StairOpts = {
  startX: number; startZ: number;
  /** Direction the stairs ascend along (unit vector in x/z) */
  dirX: number; dirZ: number;
  steps: number;
  stepRise: number;
  stepRun: number;
  width: number;
  color: string;
  sideColor: string;
};

function stairFlight(out: WorldData, opts: StairOpts) {
  const perp: [number, number] = [-opts.dirZ, opts.dirX]; // 90° rotate
  for (let i = 0; i < opts.steps; i++) {
    const cx = opts.startX + opts.dirX * (i + 0.5) * opts.stepRun;
    const cz = opts.startZ + opts.dirZ * (i + 0.5) * opts.stepRun;
    const cy = (i + 1) * opts.stepRise / 2; // step center y, going from y=rise/2 up. Wait, fix below.
    // We want step i to have its TOP at (i+1) * stepRise, so top_y = (i+1)*stepRise.
    // The center y is top - hy where hy = stepRise/2 + something. Let's make each step a thin slab:
    // top_y = (i+1) * stepRise, hy = (i+1) * stepRise / 2, so it goes from 0 to top_y.
    // That makes each step rest on the prior step in a tiered way.
    // Easier: each step is its own thin slab.
    // Reset cy:
    const topY = (i + 1) * opts.stepRise;
    const hy = topY / 2;
    const centerY = topY - hy;
    // Width-aligned along perp direction:
    const hx = Math.abs(perp[0]) > 0.5 ? opts.width / 2 : opts.stepRun / 2;
    const hz = Math.abs(perp[1]) > 0.5 ? opts.width / 2 : opts.stepRun / 2;
    // But step depth should be along dir, not arbitrary. Use dir for depth, perp for width:
    const dHx = Math.abs(opts.dirX) > 0.5 ? opts.stepRun / 2 : opts.width / 2;
    const dHz = Math.abs(opts.dirZ) > 0.5 ? opts.stepRun / 2 : opts.width / 2;
    solidBox(out, cx, centerY, cz, dHx, hy, dHz, opts.color, { rough: 0.85 });
    // Side rails (decorative)
    const railColor = opts.sideColor;
    const railX1 = cx + perp[0] * (opts.width / 2 + 0.03);
    const railZ1 = cz + perp[1] * (opts.width / 2 + 0.03);
    const railX2 = cx - perp[0] * (opts.width / 2 + 0.03);
    const railZ2 = cz - perp[1] * (opts.width / 2 + 0.03);
    decoCyl(out, railX1, topY + 0.25, railZ1, 0.04, 0.5, railColor);
    decoCyl(out, railX2, topY + 0.25, railZ2, 0.04, 0.5, railColor);
    void hx; void hz;
  }
}

type LadderOpts = {
  anchorX: number; anchorZ: number;
  faceNormalX: number; faceNormalZ: number;
  baseY: number;
  topY: number;
  width: number;
};

/** A ladder is a stack of small platforms with a wood frame. */
function ladder(out: WorldData, opts: LadderOpts) {
  const perp: [number, number] = [-opts.faceNormalZ, opts.faceNormalX];
  const dy = 0.7;
  const rungs = Math.max(2, Math.floor((opts.topY - opts.baseY) / dy));
  // Frame uprights
  for (const sign of [1, -1] as const) {
    const fx = opts.anchorX + perp[0] * (opts.width / 2) * sign + opts.faceNormalX * 0.06;
    const fz = opts.anchorZ + perp[1] * (opts.width / 2) * sign + opts.faceNormalZ * 0.06;
    decoCyl(out, fx, (opts.baseY + opts.topY) / 2, fz, 0.04, opts.topY - opts.baseY + 0.2, C.wood);
  }
  for (let i = 1; i <= rungs; i++) {
    const y = opts.baseY + i * dy;
    const cx = opts.anchorX + opts.faceNormalX * 0.18;
    const cz = opts.anchorZ + opts.faceNormalZ * 0.18;
    // Rung platform — small landable platform
    const hx = Math.abs(opts.faceNormalX) > 0.5 ? 0.15 : opts.width / 2;
    const hz = Math.abs(opts.faceNormalZ) > 0.5 ? 0.15 : opts.width / 2;
    solidBox(out, cx, y, cz, hx, 0.04, hz, C.woodLight, { rough: 0.9 });
  }
}

type TreeOpts = {
  x: number; z: number;
  height: number;
  /** climbable platforms at intervals up the tree */
  climbable: boolean;
};

function tree(out: WorldData, opts: TreeOpts) {
  const trunkR = 0.32 + (opts.height / 6) * 0.1;
  const trunkH = opts.height;
  decoCyl(out, opts.x, trunkH / 2, opts.z, trunkR, trunkH, C.treeTrunk, { segments: 10 });
  // Trunk collider (AABB approximation of the cylinder)
  out.boxes.push({ x: opts.x, y: trunkH / 2, z: opts.z, hx: trunkR * 0.85, hy: trunkH / 2, hz: trunkR * 0.85 });
  // Foliage: stacked spheres
  const folBase = trunkH - 0.2;
  decoSphere(out, opts.x, folBase + 0.6, opts.z, 1.3, C.treeFol);
  decoSphere(out, opts.x - 0.7, folBase + 0.4, opts.z + 0.3, 1.0, C.treeFol2);
  decoSphere(out, opts.x + 0.6, folBase + 0.5, opts.z - 0.4, 1.0, C.treeFol2);
  decoSphere(out, opts.x + 0.1, folBase + 1.4, opts.z + 0.1, 0.9, C.treeFol);
  if (opts.climbable) {
    // 3 branch platforms at varying heights/sides
    const branches: [number, number, number, number, number][] = [
      [opts.x + 1.1, 2.2, opts.z + 0.1, 0.45, 0.45],
      [opts.x - 1.0, 3.3, opts.z + 0.2, 0.45, 0.45],
      [opts.x + 0.2, 4.4, opts.z - 1.1, 0.45, 0.45],
    ];
    for (const [bx, by, bz, bhx, bhz] of branches) {
      if (by < trunkH - 0.5) {
        solidBox(out, bx, by, bz, bhx, 0.1, bhz, C.treeTrunk, { rough: 0.9 });
      }
    }
  }
}

/** A tall climbing tree with branch platforms stepping up to about y=8. */
function climbingTree(out: WorldData, cx: number, cz: number, topY: number) {
  const trunkR = 0.5;
  const trunkH = topY + 0.5;
  decoCyl(out, cx, trunkH / 2, cz, trunkR, trunkH, C.treeTrunk, { segments: 12 });
  // Trunk collider
  out.boxes.push({ x: cx, y: trunkH / 2, z: cz, hx: trunkR * 0.85, hy: trunkH / 2, hz: trunkR * 0.85 });
  // Branch platforms stepping up alternately around the trunk
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
    solidBox(out, cx + dx, by, cz + dz, 0.6, 0.1, 0.6, C.treeTrunk, { rough: 0.9 });
    // Foliage clump on each landing
    decoSphere(out, cx + dx * 1.4, by + 0.4, cz + dz * 1.4, 0.6, C.treeFol);
    decoSphere(out, cx + dx * 1.4, by + 0.6, cz + dz * 1.4 - 0.3, 0.45, C.treeFol2);
  }
  // Big crown of foliage at the top
  decoSphere(out, cx,        topY + 0.9, cz,        1.5, C.treeFol);
  decoSphere(out, cx - 0.9,  topY + 0.7, cz + 0.4,  1.1, C.treeFol2);
  decoSphere(out, cx + 0.8,  topY + 0.8, cz - 0.5,  1.1, C.treeFol2);
  decoSphere(out, cx + 0.2,  topY + 1.6, cz + 0.1,  0.9, C.treeFol);
}

/** A square stone tower with internal stairs spiralling up. Stairs land at given y values. */
function outerScaffold(out: WorldData, cx: number, cz: number, topY: number, color = C.cobble) {
  const tw = 2.2; // half-width of the tower
  // Tower body — hollow visually but we model it as a single box. The stairs are external.
  const totalH = topY;
  decoBox(out, cx, totalH / 2, cz, tw, totalH / 2, tw, color, { rough: 0.95, cast: true });
  // Collidable column at the center so you can't pass through it
  out.boxes.push({ x: cx, y: totalH / 2, z: cz, hx: tw * 0.9, hy: totalH / 2, hz: tw * 0.9 });
  // External staircase wrapping the tower
  const steps = Math.floor(totalH / 0.85);
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 2 + 0.4; // start angle
    const r = tw + 0.5;
    const sx = cx + Math.cos(a) * r;
    const sz = cz + Math.sin(a) * r;
    const sy = 0.5 + i * 0.85;
    solidBox(out, sx, sy, sz, 0.7, 0.12, 0.7, C.wood, { rough: 0.85 });
    // small rail post
    decoCyl(out, sx, sy + 0.35, sz, 0.04, 0.7, C.wood);
  }
  // Top platform — wider than the tower for a landing pad
  solidBox(out, cx, topY + 0.2, cz, tw + 0.8, 0.2, tw + 0.8, C.cobbleEdge);
  // Conical roof
  decoCone(out, cx, topY + 0.4 + 0.9, cz, tw + 1.0, 1.8, C.roofCoral, { rotY: Math.PI / 4, segments: 4 });
  // Window halfway up
  decoBox(out, cx, totalH * 0.55, cz + tw + 0.01, 0.35, 0.3, 0.04, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.55 });
  decoBox(out, cx, totalH * 0.55, cz + tw + 0.01, 0.4, 0.35, 0.05, C.windowFrame);
}

function lantern(out: WorldData, x: number, baseY: number, z: number, height = 2.2) {
  decoCyl(out, x, baseY + height / 2, z, 0.05, height, C.metal);
  decoSphere(out, x, baseY + height + 0.15, z, 0.2, C.lanternGlow, { emissive: C.lanternGlow, emissiveIntensity: 1.6 });
  decoBox(out, x, baseY + height + 0.35, z, 0.08, 0.08, 0.08, C.lanternBody);
}

function mushroom(out: WorldData, x: number, z: number, scale = 1, purple = false) {
  const stemH = 0.4 * scale;
  decoCyl(out, x, stemH / 2, z, 0.12 * scale, stemH, C.mushStem);
  decoSphere(out, x, stemH + 0.18 * scale, z, 0.32 * scale, purple ? C.mushCapPurple : C.mushCap);
  decoSphere(out, x - 0.1 * scale, stemH + 0.3 * scale, z + 0.05 * scale, 0.05 * scale, '#fef9c3');
  decoSphere(out, x + 0.1 * scale, stemH + 0.25 * scale, z - 0.07 * scale, 0.05 * scale, '#fef9c3');
}

function flowerPatch(out: WorldData, x: number, z: number, count: number, rng: () => number) {
  for (let i = 0; i < count; i++) {
    const fx = x + (rng() * 2 - 1) * 0.5;
    const fz = z + (rng() * 2 - 1) * 0.5;
    const h = 0.15 + rng() * 0.1;
    decoCyl(out, fx, h / 2, fz, 0.02, h, '#4ade80');
    const color = ['#f43f5e', '#facc15', '#a855f7', '#38bdf8'][Math.floor(rng() * 4)];
    decoSphere(out, fx, h + 0.07, fz, 0.07, color);
  }
}

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

  // Visual: single long rotated plank — looks smooth and continuous
  decoBox(out, cx, y, cz, halfW, halfTH, len / 2, C.plank, { rotY, rough: 0.85 });

  // Physics: chain of small axis-aligned AABBs along the centerline.
  // AABB rotation isn't supported, so for an east-west visual a north-south
  // AABB would miss everything except the center. Segments are short enough
  // (≤0.6m) that the bounding AABB stays close to the actual plank shape.
  const dirX = dx / len;
  const dirZ = dz / len;
  const segMax = 0.6;
  const numSegs = Math.max(1, Math.ceil(len / segMax));
  const segLen = len / numSegs;
  for (let i = 0; i < numSegs; i++) {
    const t = (i + 0.5) / numSegs;
    const sx = x1 + dx * t;
    const sz = z1 + dz * t;
    // Bounding AABB of a rotated rectangle (halfLen along direction × halfW perpendicular)
    const hxSeg = Math.abs(dirX) * (segLen / 2) + Math.abs(dirZ) * halfW;
    const hzSeg = Math.abs(dirZ) * (segLen / 2) + Math.abs(dirX) * halfW;
    out.boxes.push({ x: sx, y, z: sz, hx: hxSeg, hy: halfTH, hz: hzSeg });
  }

  // Rope rails (visual only)
  for (const sign of [1, -1] as const) {
    const ox = -Math.cos(rotY) * 0.75 * sign;
    const oz = Math.sin(rotY) * 0.75 * sign;
    decoBox(out, cx + ox, y + 0.5, cz + oz, 0.03, 0.5, len / 2, C.wood, { rotY });
  }
  // End posts (visual)
  for (const [ex, ez] of [[x1, z1], [x2, z2]] as const) {
    decoCyl(out, ex, y + 0.4, ez, 0.08, 0.8, C.wood);
  }
}

function platform(out: WorldData, x: number, y: number, z: number, hx: number, hz: number, color = C.grassDeep, top = C.grass) {
  const hy = 0.3;
  // Side
  solidBox(out, x, y - hy, z, hx, hy, hz, color, { rough: 0.9 });
  // Grass top (slightly larger, slightly above for visual flair)
  decoBox(out, x, y - 0.04, z, hx * 1.02, 0.06, hz * 1.02, top, { rough: 0.9 });
}

function cloudPlatform(out: WorldData, x: number, y: number, z: number, r: number) {
  // Soft, blob-like platform: 1 flat box for physics, surrounded by spheres for the puffy look
  solidBox(out, x, y - 0.15, z, r, 0.15, r * 0.7, C.cloud, { rough: 1 });
  decoSphere(out, x - r * 0.4, y, z, r * 0.55, C.cloud);
  decoSphere(out, x + r * 0.45, y, z + r * 0.1, r * 0.6, C.cloud);
  decoSphere(out, x + r * 0.05, y, z - r * 0.4, r * 0.5, C.cloud);
  decoSphere(out, x - r * 0.2, y + 0.05, z + r * 0.3, r * 0.4, C.cloudEdge);
}

function crystal(out: WorldData, x: number, baseY: number, z: number, height: number) {
  const c = [C.crystalA, C.crystalB, C.crystalC][Math.floor((x * 7 + z * 13) % 3)];
  decoCone(out, x, baseY + height / 2, z, 0.7, height, c, { segments: 6 });
  decoCone(out, x, baseY + height / 2 + 0.4, z, 0.4, height * 0.4, C.crystalB, { segments: 6 });
  // small landable cap
  solidBox(out, x, baseY + height + 0.05, z, 0.45, 0.05, 0.45, C.crystalC, { rough: 0.3 });
}

function spiralTower(out: WorldData, cx: number, cz: number, baseY: number, topY: number) {
  const tR = 1.6;
  const totalH = topY - baseY;
  // Tower body (cylinder visual)
  decoCyl(out, cx, baseY + totalH / 2, cz, tR, totalH, C.cobble, { segments: 18 });
  // Square collider inside the cylinder — slightly smaller so steps remain reachable
  solidBox(out, cx, baseY + totalH / 2, cz, tR * 0.78, totalH / 2, tR * 0.78, C.cobble);
  // Wider, more visible spiral — 18 steps, 2.5 turns, pushed further from the tower
  const steps = 18;
  const stepRise = totalH / steps;     // ~0.5m vertical between adjacent step tops
  const turns = 2.5;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const sR = tR + 1.05;
    const sx = cx + Math.cos(a) * sR;
    const sz = cz + Math.sin(a) * sR;
    const sy = baseY + (i + 0.5) * stepRise;
    const halfY = stepRise / 2 + 0.04;
    // alternate the wood tone to make individual treads visible
    const color = i % 2 === 0 ? C.wood : C.woodLight;
    solidBox(out, sx, sy, sz, 0.7, halfY, 0.7, color, { rotY: -a, rough: 0.85 });
    // tiny rail post on the outer side of each step
    decoCyl(out, sx + Math.cos(a) * 0.7, sy + halfY + 0.35, sz + Math.sin(a) * 0.7, 0.04, 0.7, C.wood);
  }
  // Top platform (landable, wider than the cylinder)
  solidBox(out, cx, topY + 0.2, cz, tR + 1.1, 0.2, tR + 1.1, C.cobble);
  // Roof cone (decorative only — player lands on top platform, roof is above)
  decoCone(out, cx, topY + 0.4 + 1.0, cz, tR + 1.3, 2.0, C.roofPlum, { rotY: Math.PI / 4, segments: 4 });
}

function floatingCottage(out: WorldData, cx: number, cz: number, baseY: number, wallColor: string, roofColor: string) {
  // Smaller version of `house`, no climbing route (you fly/jump in)
  const wallW = 3, wallD = 2.6, wallH = 1.8;
  // base platform
  solidBox(out, cx, baseY - 0.1, cz, wallW / 2 + 0.6, 0.1, wallD / 2 + 0.6, C.grassDeep);
  decoBox(out, cx, baseY - 0.04, cz, wallW / 2 + 0.65, 0.04, wallD / 2 + 0.65, C.grass);
  // walls
  solidBox(out, cx, baseY + wallH / 2, cz, wallW / 2, wallH / 2, wallD / 2, wallColor);
  // roof platform
  const roofPlatformY = baseY + wallH + 0.15;
  solidBox(out, cx, roofPlatformY, cz, wallW / 2 + 0.05, 0.15, wallD / 2 + 0.05, '#9ca3af');
  // pyramid roof
  decoCone(out, cx, roofPlatformY + 0.15 + 0.65, cz, (Math.max(wallW, wallD) / 2 + 0.15) * Math.SQRT2, 1.3, roofColor, { rotY: Math.PI / 4, segments: 4 });
  // chimney + smoke
  decoBox(out, cx + 0.6, roofPlatformY + 0.5, cz - 0.5, 0.15, 0.5, 0.15, '#7f1d1d');
  out.smoke.push({ x: cx + 0.6, y: roofPlatformY + 1.1, z: cz - 0.5 });
  // glowing window
  decoBox(out, cx, baseY + wallH * 0.62, cz + wallD / 2 + 0.02, 0.3, 0.25, 0.04, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.7 });
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

  // ── ground ──
  // Grass plate — colored directly (no decorative overlay, avoids z-fighting)
  solidBox(out, 0, -0.5, 0, 30, 0.5, 30, C.grass, { rough: 1, receive: true });
  // Cobblestone plaza in the center, raised slightly above the grass top
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const a = (i - 2.5) * 1.1;
      const b = (j - 2.5) * 1.1;
      const shade = 0.85 + rng() * 0.2;
      decoBox(out, a, 0.015, b, 0.5, 0.015, 0.5, shadeColor(C.cobble, shade), { cast: false });
    }
  }
  // A grass-tone variation ring just outside the plaza for visual interest
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const r = 8 + rng() * 0.5;
    const px = Math.cos(ang) * r;
    const pz = Math.sin(ang) * r;
    decoBox(out, px, 0.015, pz, 0.4, 0.015, 0.4, C.grassDark, { cast: false });
  }

  // ── 4 cottages around the plaza ──
  type Cottage = { cx: number; cz: number; w: string; r: string; door: HouseOpts['doorFace']; window: HouseOpts['windowFace']; climb: HouseOpts['climbFace']; kind: 'stair' | 'ladder' };
  const cottages: Cottage[] = [
    { cx: -10, cz:  10, w: C.wallCream, r: C.roofRed,   door: 'east',  window: 'north', climb: 'east',  kind: 'stair'  },
    { cx:  10, cz:  10, w: C.wallMint,  r: C.roofTeal,  door: 'west',  window: 'north', climb: 'west',  kind: 'ladder' },
    { cx: -10, cz: -10, w: C.wallPink,  r: C.roofLav,   door: 'east',  window: 'south', climb: 'east',  kind: 'ladder' },
    { cx:  10, cz: -10, w: C.wallSky,   r: C.roofCoral, door: 'west',  window: 'south', climb: 'west',  kind: 'stair'  },
  ];
  const cottageRoofY = 3.0; // wallH=3, top of walls; roof platform sits at ~3.15
  for (const c of cottages) {
    house(out, {
      cx: c.cx, cz: c.cz, baseY: 0,
      wallW: 5, wallD: 4, wallH: 3, roofH: 1.6,
      wallColor: c.w, roofColor: c.r,
      doorFace: c.door, windowFace: c.window, climbFace: c.climb, climbKind: c.kind,
    });
  }

  // ── bridges between rooftops ──
  // Connect rooftops in a ring with arches at the corners.
  const ringRoofY = cottageRoofY + 0.4;
  // SW <-> NW (along z axis between x=-10)
  bridge(out, -10, 7, -10, -7, ringRoofY);
  // SE <-> NE
  bridge(out,  10, 7,  10, -7, ringRoofY);
  // NW <-> NE
  bridge(out, -7, -10,  7, -10, ringRoofY);
  // SW <-> SE
  bridge(out, -7,  10,  7,  10, ringRoofY);

  // ── central spiral tower ──
  const towerTopY = 9;
  spiralTower(out, 0, 0, 0, towerTopY);
  out.flags.push({ x: 0, y: towerTopY + 2.3, z: 0, rotY: 0, color: C.flag1 });

  // ── alternate climbing route 1: outer stone tower (east) ──
  outerScaffold(out, 16, 0, 9, C.cobble);
  out.flags.push({ x: 16, y: 9 + 2.3, z: 0, rotY: Math.PI / 2, color: C.flag2 });
  // Bridge from outer tower top to the central tower top platform
  bridge(out, 16 - 3.0, 0, 0 + 2.6, 0, 9.4);

  // ── alternate climbing route 2: tall climbing tree (west) ──
  climbingTree(out, -16, 0, 8);
  // Bridge from the tree's top branch to the central tower top platform
  bridge(out, -16 + 0.6, 0, -2.6, 0, 8.5);

  // ── alternate climbing route 3: cottage NE → stepping stones up ──
  // cottage NE is at (10, -10), roof top ~3.3.
  // Stack of crate platforms outside it rising toward the outer tower (route 1)
  solidBox(out, 13, 4.5, -10, 0.7, 0.3, 0.7, C.wood, { rough: 0.85 });
  solidBox(out, 15, 6.0, -8, 0.8, 0.3, 0.8, C.wood);
  solidBox(out, 16, 7.5, -5, 0.9, 0.3, 0.9, C.wood);
  // → lands you near the outer tower's mid-level stairs

  // bridges from rooftops to tower base of stairs (give multi-path connections)
  // Diagonal bridges from cottage roofs to the tower's first step level (~y=1.5)
  // Actually simpler: place stepping platforms between roof and tower
  platform(out, -5, 2.5, 5, 0.7, 0.7, C.dirt, C.grassDeep);
  platform(out,  5, 2.5, 5, 0.7, 0.7, C.dirt, C.grassDeep);
  platform(out, -5, 2.5, -5, 0.7, 0.7, C.dirt, C.grassDeep);
  platform(out,  5, 2.5, -5, 0.7, 0.7, C.dirt, C.grassDeep);

  // ── decorative trees around the perimeter (climbing tree handles the climbing job at -16,0) ──
  const treeSpots: [number, number, number, boolean][] = [
    [-16,  14, 5, false],
    [ 16,  14, 5, true],
    [-16, -14, 5, false],
    [ 16, -14, 5, true],
    [  0,  18, 4, false],
    [  0, -18, 4, false],
    [ 18,   8, 4, false],
    [ 18,  -8, 4, false],
  ];
  for (const [tx, tz, th, climb] of treeSpots) {
    tree(out, { x: tx, z: tz, height: th, climbable: climb });
  }

  // ── decorative props on the ground ──
  for (let i = 0; i < 8; i++) {
    lantern(out, Math.cos(i / 8 * Math.PI * 2) * 6, 0, Math.sin(i / 8 * Math.PI * 2) * 6, 2.0);
  }
  // mushrooms
  for (let i = 0; i < 20; i++) {
    const ang = rng() * Math.PI * 2;
    const r = 12 + rng() * 14;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    mushroom(out, x, z, 0.6 + rng() * 0.7, rng() > 0.7);
  }
  // flower patches
  for (let i = 0; i < 14; i++) {
    const ang = rng() * Math.PI * 2;
    const r = 6 + rng() * 18;
    flowerPatch(out, Math.cos(ang) * r, Math.sin(ang) * r, 5 + Math.floor(rng() * 5), rng);
  }
  // flag poles around the plaza
  for (const [fx, fz, col] of [[7, 7, C.flag1], [-7, 7, C.flag2], [-7, -7, C.flag3], [7, -7, C.flag1]] as const) {
    decoCyl(out, fx, 1.5, fz, 0.06, 3, C.wood);
    out.flags.push({ x: fx, y: 2.7, z: fz, rotY: Math.atan2(fz, fx), color: col });
  }

  // ── above the tower: hand-tuned vertical climb ──
  // Note: single-jump apex is ~3.0m, double-jump apex ~5.0m. Vertical gaps below stay <= 2.2m.
  const towerTop = towerTopY + 0.4; // 9.4

  // Stepping stones rising from the tower's top platform
  let y = towerTop + 1.8;            // 11.2
  platform(out,  3.5, y, -0.5, 1.0, 1.0, C.dirt, C.grassDeep);
  y += 2.0;                          // 13.2
  platform(out, -2.5, y,  2.0, 1.0, 1.0, C.dirt, C.grassDeep);
  y += 2.0;                          // 15.2
  platform(out,  1.5, y,  3.5, 1.0, 1.0, C.dirt, C.grassDeep);
  y += 2.0;                          // 17.2
  platform(out, -3.5, y, -0.5, 1.2, 1.2, C.dirt, C.grassDeep);

  // Floating cottage 1 (lavender + gold roof): base platform sits at y=18
  const floatY = 18;
  floatingCottage(out, -2, floatY, -5, C.wallLav, C.roofGold);

  // Aerial walkway from the last stepper to cottage 1 — three planks in the air
  bridge(out, -3.5, -0.5, -3.0, -2.5, 17.8);
  bridge(out, -3.0, -2.5, -2.0, -4.0, 17.9);
  // small landing pad at edge of cottage 1's base
  platform(out, -2.0, 18.0, -4.0, 0.6, 0.6, C.dirt, C.grassDeep);

  // Floating cottage 2 (cream + teal): just above cottage 1's roof level
  // cottage 1 roof top is at 18 + 1.8 + 0.3 = 20.1
  const floatY2 = 21;
  floatingCottage(out, 5, floatY2, 2, C.wallCream, C.roofTeal);
  // Bridge between roof of cottage 1 and base platform of cottage 2
  bridge(out, -2 + 1.7, -5 + 1.4, 5 - 1.7, 2 - 1.5, 20.4);

  // ── windmill tower next to / above cottage 2 ──
  // cottage 2 roof top = 21 + 1.8 + 0.3 = 23.1
  // We want the windmill top platform reachable from cottage 2 roof, so
  // anchor the windmill base near the cottage 2 roof level.
  const wmBaseY = 23;
  const wmTowerH = 6.5;
  const wmCX = 10;
  const wmCZ = -6;
  // tower body
  decoCyl(out, wmCX, wmBaseY + wmTowerH / 2, wmCZ, 0.9, wmTowerH, C.cobble, { segments: 14 });
  solidBox(out, wmCX, wmBaseY + wmTowerH / 2, wmCZ, 0.7, wmTowerH / 2, 0.7, C.cobble);
  // top platform
  solidBox(out, wmCX, wmBaseY + wmTowerH + 0.2, wmCZ, 1.6, 0.2, 1.6, C.cobbleEdge);
  // windmill roof cone
  decoCone(out, wmCX, wmBaseY + wmTowerH + 0.4 + 0.8, wmCZ, 2.0, 1.6, C.roofGold, { rotY: Math.PI / 4, segments: 4 });
  // animated blades
  out.windmills.push({ x: wmCX, y: wmBaseY + wmTowerH * 0.7, z: wmCZ + 0.85, rotY: 0 });
  // External climbing rungs on the +z face of the windmill — alternative to jumping the spurs
  for (let i = 0; i < 9; i++) {
    const ry = wmBaseY + 0.5 + i * 0.75;
    solidBox(out, wmCX, ry, wmCZ + 1.0, 0.5, 0.05, 0.15, C.wood, { rough: 0.9 });
  }
  // Decorative wood rails connecting the rungs vertically
  decoCyl(out, wmCX - 0.45, wmBaseY + wmTowerH / 2, wmCZ + 1.05, 0.04, wmTowerH, C.wood);
  decoCyl(out, wmCX + 0.45, wmBaseY + wmTowerH / 2, wmCZ + 1.05, 0.04, wmTowerH, C.wood);

  // Bridge from cottage 2 roof to the windmill base — alternative entry to the rungs
  bridge(out, 5 + 1.7, 2 - 1.4, wmCX - 0.9, wmCZ + 0.5, 23.2);

  // ── Above the windmill: cloud staircase ──
  const wmTop = wmBaseY + wmTowerH + 0.4; // 29.9
  let cy = wmTop + 2.0;             // 31.9
  cloudPlatform(out,  6, cy, -3, 1.9);
  cy += 2.1;                         // 34.0
  cloudPlatform(out, -1, cy, -2, 1.7);
  cy += 2.1;                         // 36.1
  cloudPlatform(out, -5, cy,  4, 1.6);
  cy += 2.1;                         // 38.2
  cloudPlatform(out,  2, cy,  6, 1.6);

  // ── Crystal spires at the top ──
  const cyTop = cy + 2.3;            // 40.5
  crystal(out, -2, cyTop,         -2, 2.0);
  crystal(out,  3, cyTop + 1.2,    1, 2.0);
  crystal(out, -1, cyTop + 2.5,    3, 2.0);

  // ── Final goal pad and orb ──
  const goalY = cyTop + 4.5;         // ~45
  // a small landing platform you can stand on
  solidBox(out, 0, goalY - 0.4, 0, 1.6, 0.2, 1.6, C.crystalA);
  decoCone(out, 0, goalY - 0.85, 0, 1.8, 0.7, C.crystalA, { rotY: 0, segments: 8 });
  out.goal = { x: 0, y: goalY + 0.6, z: 0 };

  // ── Decorative far clouds at high altitude (skybox depth) ──
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + rng() * 0.3;
    const r = 60 + rng() * 30;
    const cx0 = Math.cos(ang) * r;
    const cz0 = Math.sin(ang) * r;
    const cy0 = 22 + rng() * 40;
    decoSphere(out, cx0, cy0, cz0, 4 + rng() * 3, C.cloud, { cast: false });
    decoSphere(out, cx0 + 3, cy0 + 0.5, cz0, 3 + rng() * 2, C.cloud, { cast: false });
    decoSphere(out, cx0 - 2, cy0 - 0.5, cz0 + 1, 3 + rng() * 2, C.cloudEdge, { cast: false });
  }

  out.maxHeight = goalY + 0.6;
  return out;
}

// ────────────────────── spawn points ──────────────────────

/** Perimeter spawn positions — picked deterministically by player id hash. */
export const SPAWN_POINTS: ReadonlyArray<readonly [number, number, number]> = [
  [-13,  1,  14],
  [ 13,  1,  14],
  [-13,  1, -14],
  [ 13,  1, -14],
  [-17,  1,   3],
  [ 17,  1,   3],
  [  3,  1,  17],
  [  3,  1, -17],
];

export function spawnFor(socketId: string): { x: number; y: number; z: number } {
  let h = 0;
  for (let i = 0; i < socketId.length; i++) h = (h * 31 + socketId.charCodeAt(i)) >>> 0;
  const [x, y, z] = SPAWN_POINTS[h % SPAWN_POINTS.length];
  return { x, y, z };
}

function shadeColor(hex: string, factor: number): string {
  // simple desaturated tint by factor (0.8..1.2)
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.min(255, Math.max(0, Math.floor(((n >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.floor(((n >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.floor((n & 0xff) * factor)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
