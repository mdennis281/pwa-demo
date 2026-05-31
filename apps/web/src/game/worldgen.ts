import type { Box } from './physics';

// ════════════════════════════════════════════════════════════════════════
//  TOWER CLIMB — WORLD (hand-built)
//
//  A cozy village climbs the south face of a great rock spire into the sky.
//  You switchback up the mountain on terraces (the rest stops / checkpoints),
//  each leg a harder challenge than the last, to a crystal beacon at the top —
//  which unlocks flight for a victory lap.
//
//  DESIGN RULES (learned the hard way):
//   • Everything you can stand on or bump is a SOLID object with a matching
//     mesh — no decorative-only bodies in the path, no floaty abstract pads.
//   • Decoration (trees, props) lives ON terraces or at the plaza edge, never
//     in a jump line — so you never clip through a tree mid-leap.
//   • The climb is hand-placed; the `Route` helper only RECORDS + ASSERTS the
//     jump graph so `worldgen.audit.ts` can independently prove it's beatable
//     (every gap in-envelope, ≥1.6 m head clearance over every foothold).
//
//    District           y       Feel       Challenge                       CP
//    Plaza              0       no-fail     —                               —
//    Garden Rise        2–8     medium      committed single jumps          CP1
//    Windmill Heights   9–19    hard        long leaps + the gondola wheel  CP2
//    The Waterworks     20–28   hard        precise leaps + a water-lift    —
//    Night Market       28–30   hard        converging carts + a double     CP3
//    Ice Reach          30–35   brutal      cracking ice, then a breather   CP4
//    The Crown          37–49   expert      FIVE forced double-jumps        —
//    The Summit         ~50     win         crystal beacon → unlocks FLIGHT
// ════════════════════════════════════════════════════════════════════════

// ────────────────────── types ──────────────────────

export type MeshDesc =
  | { type: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; color: string; rotY?: number; cast?: boolean; receive?: boolean; emissive?: string; emissiveIntensity?: number; roughness?: number }
  | { type: 'cone'; x: number; y: number; z: number; radius: number; height: number; color: string; rotY?: number; segments?: number; cast?: boolean; emissive?: string; emissiveIntensity?: number }
  | { type: 'cylinder'; x: number; y: number; z: number; radius: number; height: number; color: string; rotY?: number; segments?: number; cast?: boolean; emissive?: string; emissiveIntensity?: number; roughness?: number }
  | { type: 'sphere'; x: number; y: number; z: number; radius: number; color: string; cast?: boolean; emissive?: string; emissiveIntensity?: number; segments?: number };

export type Windmill = { x: number; y: number; z: number; rotY: number; scale?: number };
export type Flag = { x: number; y: number; z: number; rotY: number; color: string };
export type SmokePuff = { x: number; y: number; z: number };
export type Waterfall = { x: number; y: number; z: number; w: number; h: number; rotY: number };
export type WaterWheel = { x: number; y: number; z: number; radius: number; rotY: number };

export type Mover = Box & {
  /** x/y/z + hx/hy/hz come from Box; written each frame from the definition. */
  color: string;
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  period: number;
  phase: number;
  prevX: number; prevY: number; prevZ: number;
  kind: 'platform' | 'wall';
  style?: 'lift' | 'shuttle' | 'ramp' | 'wall' | 'cart' | 'gondola';
  /** If set, the mover ORBITS this pivot in the x-y plane (a turning windmill /
   *  Ferris-wheel gondola you ride up). `period` is the orbit time; `phase` is
   *  the starting fraction around the circle. Overrides the linear A→B path. */
  orbit?: { px: number; py: number; pz: number; radius: number };
};

/** A platform that CRACKS and falls away ~0.5 s after the local player stands
 *  on it, then respawns a few seconds later. `triggeredAt` is mutable client
 *  state (ms, -1 = solid/idle), set by Player and read by World for animation. */
export type Breakaway = {
  x: number; y: number; z: number; hx: number; hy: number; hz: number;
  color: string;
  triggeredAt: number;
};

export type Checkpoint = { x: number; y: number; z: number; name: string; zone: number; radius: number };
export type Zone = { name: string; minY: number; tint: string };
export type Edge = {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  band: Band;
  kind: 'walk' | 'jump' | 'double' | 'ladder' | 'mover' | 'shortcut' | 'stair';
};

export type WorldData = {
  boxes: Box[];
  ladders: Box[];
  movers: Mover[];
  breakaways: Breakaway[];
  meshes: MeshDesc[];
  windmills: Windmill[];
  flags: Flag[];
  smoke: SmokePuff[];
  waterfalls: Waterfall[];
  waterwheels: WaterWheel[];
  checkpoints: Checkpoint[];
  zones: Zone[];
  edges: Edge[];
  goal: { x: number; y: number; z: number };
  summitY: number;
  maxHeight: number;
};

// ────────────────────── palette ──────────────────────

const C = {
  grass: '#9be37c', grassDeep: '#65d249', grassDark: '#3a9b2c', grassMoss: '#7bbf4e',
  dirt: '#b07a3a', dirtDark: '#704a1f',
  cobble: '#aab3bc', cobbleEdge: '#5e6a76', cobbleDark: '#7a8590',
  wood: '#7a4b1e', woodLight: '#a06b34', woodDark: '#522e10', plank: '#8a5526',

  wallCream: '#fff1d0', wallMint: '#b9f0d4', wallPink: '#ffc8e1', wallSky: '#bee0ff',
  wallLav: '#dcc8ff', wallPeach: '#ffd4b3', wallOlive: '#d6e0a3',
  roofRed: '#d8451f', roofTeal: '#0f9a8d', roofCoral: '#ee7e3d', roofLav: '#7b3fd6',
  roofPlum: '#a233a8', roofGold: '#d99826', roofBlue: '#1e63d4', roofForest: '#1b7a3a',

  treeTrunk: '#5d3a17', treeTrunkLight: '#8b5a2b', treeFol: '#22a045', treeFol2: '#3fc262',
  treeFolDark: '#157032', treeBlossom: '#ffc0cb',

  lanternGlow: '#ffd97a', lanternBody: '#7b2a0d',
  mushCap: '#dc2626', mushCapPurple: '#9333ea', mushCapBlue: '#3b82f6', mushStem: '#fff6e0',

  cloud: '#f8fafc', cloudEdge: '#e2e8f0',
  crystalA: '#9a7af3', crystalB: '#c4b5fd', crystalC: '#7dd3fc', crystalD: '#fbcfe8', crystalGold: '#fde68a',

  doorBrown: '#5e2d10', windowGlow: '#ffe49a', windowFrame: '#5e2d10',
  flag1: '#ef4444', flag2: '#2563eb', flag3: '#f59e0b', flag4: '#10b981', flag5: '#a855f7',
  smoke: '#cbd5e1', metal: '#475569', metalLight: '#9aa3ad',
  water: '#3aa9d6', waterDeep: '#1e6fa8', haystack: '#f5d062', cabbage: '#76c25b',
  pumpkin: '#e08530', rope: '#a87a3a', fenceWood: '#8a5526',

  // the mountain
  rock: '#8d7a63', rockDark: '#6b5a45', rockLight: '#a8957b', rockMoss: '#6f9a4e',
  campfire: '#ff7a1a', tent: '#c2613a',
  cpCloth: '#22c55e', cpClothDim: '#15803d',
};

// ────────────────────── rng (decor only) ──────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

// ────────────────────── primitives ──────────────────────

function solidBox(out: WorldData, x: number, y: number, z: number, hx: number, hy: number, hz: number, color: string, opts: { rotY?: number; rough?: number; cast?: boolean; receive?: boolean } = {}) {
  out.boxes.push({ x, y, z, hx, hy, hz });
  out.meshes.push({ type: 'box', x, y, z, hx, hy, hz, color, rotY: opts.rotY, roughness: opts.rough, cast: opts.cast, receive: opts.receive });
}
function decoBox(out: WorldData, x: number, y: number, z: number, hx: number, hy: number, hz: number, color: string, opts: { rotY?: number; emissive?: string; emissiveIntensity?: number; rough?: number; cast?: boolean } = {}) {
  out.meshes.push({ type: 'box', x, y, z, hx, hy, hz, color, rotY: opts.rotY, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity, roughness: opts.rough, cast: opts.cast });
}
function decoCone(out: WorldData, x: number, y: number, z: number, radius: number, height: number, color: string, opts: { rotY?: number; segments?: number; cast?: boolean; emissive?: string; emissiveIntensity?: number } = {}) {
  out.meshes.push({ type: 'cone', x, y, z, radius, height, color, rotY: opts.rotY, segments: opts.segments, cast: opts.cast, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity });
}
function decoCyl(out: WorldData, x: number, y: number, z: number, radius: number, height: number, color: string, opts: { rotY?: number; segments?: number; cast?: boolean; emissive?: string; emissiveIntensity?: number } = {}) {
  out.meshes.push({ type: 'cylinder', x, y, z, radius, height, color, rotY: opts.rotY, segments: opts.segments, cast: opts.cast, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity });
}
function decoSphere(out: WorldData, x: number, y: number, z: number, radius: number, color: string, opts: { cast?: boolean; emissive?: string; emissiveIntensity?: number; segments?: number } = {}) {
  out.meshes.push({ type: 'sphere', x, y, z, radius, color, cast: opts.cast, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity, segments: opts.segments });
}

const LADDER_OVERSHOOT = 1.2;
/** A climb volume recessed against a wall, with a wooden frame + rungs. */
function ladderVolume(out: WorldData, opts: { cx: number; cz: number; baseY: number; topY: number; faceX: number; faceZ: number; width?: number }) {
  const w = (opts.width ?? 0.95) / 2;
  const perp: [number, number] = [-opts.faceZ, opts.faceX];
  const volTopY = opts.topY + LADDER_OVERSHOOT;
  const cy = (opts.baseY + volTopY) / 2;
  const hy = (volTopY - opts.baseY) / 2;
  const halfThickness = 0.35;
  const hxVol = Math.abs(opts.faceX) > 0.5 ? halfThickness : w;
  const hzVol = Math.abs(opts.faceZ) > 0.5 ? halfThickness : w;
  out.ladders.push({ x: opts.cx, y: cy, z: opts.cz, hx: hxVol, hy, hz: hzVol });
  for (const sign of [1, -1] as const) {
    decoCyl(out, opts.cx + perp[0] * w * sign, (opts.baseY + opts.topY) / 2, opts.cz + perp[1] * w * sign, 0.07, opts.topY - opts.baseY + 0.2, C.wood);
  }
  const rotY = Math.atan2(opts.faceZ, opts.faceX) + Math.PI / 2;
  const nRungs = Math.max(2, Math.floor((opts.topY - opts.baseY) / 0.45));
  for (let i = 1; i <= nRungs; i++) decoBox(out, opts.cx, opts.baseY + i * 0.45, opts.cz, w - 0.05, 0.045, 0.04, C.woodLight, { rotY });
}

/** Breakaway (ice) timing — shared by Player (collision) and World (animation). */
const BREAK_DELAY_MS = 340;     // crack → start falling (tight — keep moving!)
const BREAK_RESPAWN_MS = 3200;  // fully gone → respawn
export { BREAK_DELAY_MS, BREAK_RESPAWN_MS };

function mover(out: WorldData, o: { ax?: number; ay?: number; az?: number; bx?: number; by?: number; bz?: number; hx: number; hy: number; hz: number; period: number; phase?: number; color?: string; kind?: 'platform' | 'wall'; style?: Mover['style']; orbit?: { px: number; py: number; pz: number; radius: number } }) {
  const ax = o.ax ?? 0, ay = o.ay ?? 0, az = o.az ?? 0, bx = o.bx ?? ax, by = o.by ?? ay, bz = o.bz ?? az;
  let ix = ax, iy = ay, iz = az;
  if (o.orbit) { const a = (o.phase ?? 0) * Math.PI * 2; ix = o.orbit.px + Math.cos(a) * o.orbit.radius; iy = o.orbit.py + Math.sin(a) * o.orbit.radius; iz = o.orbit.pz; }
  out.movers.push({
    x: ix, y: iy, z: iz, hx: o.hx, hy: o.hy, hz: o.hz, color: o.color ?? C.woodLight,
    ax, ay, az, bx, by, bz, period: o.period, phase: o.phase ?? 0,
    prevX: ix, prevY: iy, prevZ: iz, kind: o.kind ?? 'platform',
    style: o.style ?? (o.kind === 'wall' ? 'wall' : 'shuttle'), orbit: o.orbit,
  });
}

/** An ice platform that cracks and drops when the local player stands on it.
 *  `topY` is the standable surface. Rendered + collided via out.breakaways. */
function iceBreakaway(out: WorldData, x: number, z: number, topY: number, hx: number, hz: number) {
  out.breakaways.push({ x, y: topY - 0.18, z, hx, hy: 0.18, hz, color: '#bfe8ff', triggeredAt: -1 });
}

/** A turning wheel of `n` level gondola platforms orbiting `pivot` in the x-y
 *  plane — ride one up. Returns the lowest/highest ride points for the Route to
 *  board at the bottom and step off at the top. Adds a decorative hub + sails. */
function gondolaWheel(out: WorldData, pivot: { x: number; y: number; z: number }, radius: number, n: number, period: number, color: string): { bottom: { x: number; y: number; z: number }; top: { x: number; y: number; z: number }; px: number; py: number; pz: number; radius: number } {
  // Sails sweep in their local x-y plane (spin about local z), and the gondolas
  // orbit in the world x-y plane — so the decorative windmill must sit at rotY 0
  // to stay coplanar with the platforms. A y-rotation would tilt the sail plane
  // 90° off the wheel (axle onto world x), which looks broken.
  out.windmills.push({ x: pivot.x, y: pivot.y, z: pivot.z + 0.1, rotY: 0, scale: radius / 2.6 });
  decoCyl(out, pivot.x, pivot.y, pivot.z, 0.4, 0.6, C.metalLight, { segments: 12 });
  const gh = 0.16;
  for (let i = 0; i < n; i++) {
    mover(out, { hx: 1.25, hy: gh, hz: 1.25, period, phase: i / n, color, style: 'gondola', orbit: { px: pivot.x, py: pivot.y, pz: pivot.z, radius } });
  }
  return { bottom: { x: pivot.x, y: pivot.y - radius + gh, z: pivot.z }, top: { x: pivot.x, y: pivot.y + radius + gh, z: pivot.z }, px: pivot.x, py: pivot.y, pz: pivot.z, radius };
}

// ════════════════════════════════════════════════════════════════════════
//  JUMP ENVELOPE + ROUTE (verification only — placement is by hand)
// ════════════════════════════════════════════════════════════════════════
const G = 28, VJ = 13, DJ = 10, SPEED = 7;
/** Max horizontal a SINGLE jump's descending arc has travelled at height +dh. */
function reachSingle(dh: number): number {
  const disc = VJ * VJ - 2 * G * dh;
  if (disc < 0) return 0;
  return SPEED * ((VJ + Math.sqrt(disc)) / G);
}
/** Max horizontal for a DOUBLE jump (second pop at apex, vy→10) landing at +dh.
 *  airtime = up(VJ/G) + up2(DJ/G) + fall from peak(=VJ²/2G+DJ²/2G) to dh. */
function reachDouble(dh: number): number {
  const peak = (VJ * VJ + DJ * DJ) / (2 * G); // ≈ 4.80 m
  if (dh >= peak) return 0;
  const t = VJ / G + DJ / G + Math.sqrt((peak - dh) * 2 / G);
  return SPEED * t;
}
// Difficulty bands. `horiz` is an upper bound; the real cap is the physics
// envelope (reachSingle/reachDouble) at the SAFETY factor below — tuned tight
// so jumps demand near-perfect commitment, not a stroll.
export type Band = 'walk' | 'easy' | 'medium' | 'hard' | 'double';
const BANDS: Record<Band, { dh: number; horiz: number; jumps: 1 | 2 }> = {
  walk: { dh: 0.6, horiz: 1.3, jumps: 1 },
  easy: { dh: 2.2, horiz: 4.2, jumps: 1 },   // a committed single jump
  medium: { dh: 2.0, horiz: 5.2, jumps: 1 }, // longer / precise single
  hard: { dh: 1.5, horiz: 6.0, jumps: 1 },   // near the single-jump limit
  double: { dh: 3.4, horiz: 9.2, jumps: 2 }, // can't be done single — must double
};
export { BANDS };
const SINGLE_SAFETY = 0.97; // gaps sit at 97% of the real single-jump arc
const DOUBLE_SAFETY = 0.93;

function halfAlong(hx: number, hz: number, dx: number, dz: number): number {
  return Math.abs(dx) * hx + Math.abs(dz) * hz;
}

/** Records + asserts the jump graph between hand-placed footholds. */
class Route {
  out: WorldData;
  x: number; y: number; z: number; hx: number; hz: number;
  label: string;
  /** spiral state: footholds wrap around (cx,cz) as `angle` advances. */
  cx = 0; cz = 0; angle = 0;
  constructor(out: WorldData, s: { x: number; y: number; z: number; hx: number; hz: number; label?: string }) {
    this.out = out; this.x = s.x; this.y = s.y; this.z = s.z; this.hx = s.hx; this.hz = s.hz; this.label = s.label ?? 'route';
  }
  /** Move the cursor to an existing foothold, asserting reachability + recording the edge. */
  link(x: number, y: number, z: number, hx: number, hz: number, band: Band, kind: Edge['kind'] = 'jump'): this {
    const ddx = x - this.x, ddz = z - this.z, len = Math.hypot(ddx, ddz) || 1;
    const ux = ddx / len, uz = ddz / len;
    const gap = Math.max(0, len - halfAlong(this.hx, this.hz, ux, uz) - halfAlong(hx, hz, ux, uz));
    const rise = y - this.y;
    if (kind === 'jump' || kind === 'double' || kind === 'walk' || kind === 'shortcut') {
      const eff: Band = kind === 'shortcut' ? 'double' : band;
      const b = BANDS[eff];
      const rr = Math.max(0, rise);
      if (rise > b.dh + 1e-6) throw new Error(`[${this.label}] ${kind} to (${x},${y},${z}): rise ${rise.toFixed(2)} > ${eff} dh ${b.dh}`);
      if (gap > b.horiz + 1e-6) throw new Error(`[${this.label}] ${kind} to (${x},${y},${z}): gap ${gap.toFixed(2)} > ${eff} horiz ${b.horiz}`);
      if (b.jumps === 1) {
        if (gap > reachSingle(rr) * SINGLE_SAFETY) throw new Error(`[${this.label}] ${eff} to (${x},${y},${z}): gap ${gap.toFixed(2)} > single limit ${(reachSingle(rr) * SINGLE_SAFETY).toFixed(2)} (rise ${rr.toFixed(2)})`);
      } else {
        // a double-jump foothold: must be UNreachable by a single (so it forces
        // the double) yet within the double-jump arc.
        if (gap <= reachSingle(rr)) throw new Error(`[${this.label}] ${eff} to (${x},${y},${z}): gap ${gap.toFixed(2)} is single-jumpable (${reachSingle(rr).toFixed(2)}) — not a real double`);
        if (gap > reachDouble(rr) * DOUBLE_SAFETY) throw new Error(`[${this.label}] ${eff} to (${x},${y},${z}): gap ${gap.toFixed(2)} > double limit ${(reachDouble(rr) * DOUBLE_SAFETY).toFixed(2)} (rise ${rr.toFixed(2)})`);
      }
    }
    this.out.edges.push({ ax: this.x, ay: this.y, az: this.z, bx: x, by: y, bz: z, band, kind });
    this.x = x; this.y = y; this.z = z; this.hx = hx; this.hz = hz;
    return this;
  }
  /** Advance `dDeg` around the OPEN centre at orbit radius `R`, rising `rise`,
   *  dropping a free-floating island foothold. The climb spirals up; the centre
   *  is open sky (just a slender decorative peak), so the camera always has air
   *  behind the player. Reachability is asserted. */
  arc(o: { dDeg: number; R: number; rise: number; hx: number; hz: number; band: Band; kind?: Edge['kind']; skin: (cx: number, cz: number, topY: number, hx: number, hz: number) => void }): this {
    this.angle += (o.dDeg * Math.PI) / 180;
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    const nx = this.cx + ca * o.R, nz = this.cz + sa * o.R, ny = this.y + o.rise;
    o.skin(nx, nz, ny, o.hx, o.hz);
    return this.link(nx, ny, nz, o.hx, o.hz, o.band, o.kind);
  }
  checkpoint(name: string, zone: number, radius = 2.6): this {
    this.out.checkpoints.push({ x: this.x, y: this.y, z: this.z, name, zone, radius });
    checkpointBanner(this.out, this.x, this.y, this.z);
    return this;
  }
}

// ════════════════════════════════════════════════════════════════════════
//  SOLID STRUCTURE HELPERS  (collider == visible mesh)
// ════════════════════════════════════════════════════════════════════════

/** A solid standable platform/terrace. `topY` is the walkable surface.
 *  Has a rock/wood skirt below so it never looks like it floats. */
function terrace(out: WorldData, cx: number, cz: number, topY: number, hx: number, hz: number, opts: {
  top?: 'grass' | 'cobble' | 'wood' | 'camp'; skirt?: number; skirtColor?: string; rail?: ('n' | 's' | 'e' | 'w')[];
} = {}) {
  const skirt = opts.skirt ?? 1.4;
  const skirtColor = opts.skirtColor ?? C.rock;
  // solid body (the collider). top of body == topY.
  solidBox(out, cx, topY - skirt / 2, cz, hx, skirt / 2, hz, skirtColor, { rough: 1, receive: true });
  // a darker base lip for grounding
  decoBox(out, cx, topY - skirt + 0.05, cz, hx + 0.08, 0.12, hz + 0.08, C.rockDark, { cast: false, rough: 1 });
  // walkable top skin
  const topColor = opts.top === 'cobble' ? C.cobble : opts.top === 'wood' ? C.woodLight : opts.top === 'camp' ? C.dirt : C.grass;
  decoBox(out, cx, topY + 0.04, cz, hx * 0.99, 0.06, hz * 0.99, topColor, { cast: false, rough: 0.95 });
  if (opts.top === 'grass') decoBox(out, cx, topY + 0.09, cz, hx * 0.7, 0.04, hz * 0.7, C.grassDeep, { cast: false });
  // edge trim
  decoBox(out, cx, topY + 0.08, cz, hx + 0.05, 0.05, hz + 0.05, C.rockDark, { cast: false });
  // railings on chosen edges (visual)
  for (const e of opts.rail ?? []) {
    const along = e === 'n' || e === 's' ? hx : hz;
    const n = Math.max(2, Math.round(along));
    const ez = e === 'n' ? cz - hz : e === 's' ? cz + hz : cz;
    const ex = e === 'w' ? cx - hx : e === 'e' ? cx + hx : cx;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * 2 - 1;
      const px = e === 'n' || e === 's' ? cx + t * hx : ex;
      const pz = e === 'e' || e === 'w' ? cz + t * hz : ez;
      decoCyl(out, px, topY + 0.45, pz, 0.05, 0.8, C.wood, { cast: false });
    }
  }
}

/** A SOLID segment of the central mountain spire (collider + detailed rock on
 *  all four faces). Footholds cantilever off it as the climb wraps around. The
 *  faces are vertical so a cantilevered ledge never gets an overhang head-bump. */
function spireSeg(out: WorldData, cx: number, cz: number, baseY: number, topY: number, half: number, opts: { snow?: boolean; rock?: string } = {}) {
  const cy = (baseY + topY) / 2, hy = (topY - baseY) / 2, span = topY - baseY;
  const rock = opts.rock ?? C.rock, dark = shadeColor(rock, 0.72), light = shadeColor(rock, 1.18);
  solidBox(out, cx, cy, cz, half, hy, half, rock, { rough: 1, receive: true });
  // strata bands wrapping all four faces (light/dark layering for depth)
  const bands = Math.max(2, Math.round(span / 3.0));
  for (let i = 0; i < bands; i++) {
    const by = baseY + (i + 0.5) / bands * span, bh = span / bands * 0.3, col = i % 2 ? dark : light;
    decoBox(out, cx, by, cz + half + 0.02, half * 0.95, bh, 0.12, col, { cast: false });
    decoBox(out, cx, by, cz - half - 0.02, half * 0.95, bh, 0.12, col, { cast: false });
    decoBox(out, cx + half + 0.02, by, cz, 0.12, bh, half * 0.95, col, { cast: false });
    decoBox(out, cx - half - 0.02, by, cz, 0.12, bh, half * 0.95, col, { cast: false });
  }
  // boulders clinging to the faces (varied sizes, all the way up)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3, by = baseY + (((i * 41) % 100) / 100) * span * 0.85 + 0.6, s = 0.4 + (i % 3) * 0.25;
    decoBox(out, cx + Math.cos(a) * (half + 0.05), by, cz + Math.sin(a) * (half + 0.05), s, s * 1.15, s, i % 2 ? dark : light, { cast: false, rough: 1 });
  }
  // moss tufts + a couple of craggy spikes
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.5; decoBox(out, cx + Math.cos(a) * (half + 0.04), baseY + (0.2 + (i % 3) * 0.22) * span, cz + Math.sin(a) * (half + 0.04), 0.5, 0.28, 0.16, C.rockMoss, { cast: false }); }
  decoCone(out, cx - half * 0.3, topY + 0.5, cz - half * 0.2, half * 0.32, 1.4, dark, { segments: 5 });
  decoCone(out, cx + half * 0.3, topY + 0.85, cz + half * 0.15, half * 0.3, 1.9, light, { segments: 5 });
  if (opts.snow) decoBox(out, cx, topY + 0.05, cz, half * 0.96, 0.2, half * 0.96, '#eef4f8', { cast: false });
}

type CottageOpts = { cx: number; cz: number; baseY: number; wallW: number; wallD: number; wallH: number; wallColor: string; roofColor: string; doorFace: 'north' | 'south' | 'east' | 'west'; walkRoof?: boolean };
function faceVec(f: 'north' | 'south' | 'east' | 'west'): [number, number] {
  return f === 'north' ? [0, -1] : f === 'south' ? [0, 1] : f === 'east' ? [1, 0] : [-1, 0];
}
/** A solid cottage. If walkRoof, the roof is a flat walkable deck. */
function cottage(out: WorldData, o: CottageOpts) {
  const { cx, cz, baseY, wallW, wallD, wallH, wallColor, roofColor } = o;
  solidBox(out, cx, baseY + wallH / 2, cz, wallW / 2, wallH / 2, wallD / 2, wallColor, { rough: 0.9 });
  const wallTop = baseY + wallH;
  if (o.walkRoof) {
    solidBox(out, cx, wallTop + 0.08, cz, wallW / 2 + 0.25, 0.08, wallD / 2 + 0.25, C.woodLight, { rough: 0.9 });
    decoBox(out, cx, wallTop + 0.18, cz, wallW / 2 + 0.3, 0.04, wallD / 2 + 0.3, C.woodDark, { cast: false });
    const chX = cx + wallW / 4, chZ = cz - wallD / 4;
    decoBox(out, chX, wallTop + 0.6, chZ, 0.22, 0.5, 0.22, '#7f1d1d');
    out.smoke.push({ x: chX, y: wallTop + 1.1, z: chZ });
  } else {
    decoCone(out, cx, wallTop + 0.7, cz, Math.min(wallW, wallD) * 0.75, 1.4, roofColor, { rotY: Math.PI / 4, segments: 4 });
    const chX = cx + wallW / 4, chZ = cz - wallD / 4;
    decoBox(out, chX, wallTop + 0.9, chZ, 0.2, 0.6, 0.2, '#7f1d1d');
    out.smoke.push({ x: chX, y: wallTop + 1.5, z: chZ });
  }
  // door + windows
  const [dnx, dnz] = faceVec(o.doorFace);
  const onZ = Math.abs(dnz) > 0;
  const dx = onZ ? 0 : dnx * (wallW / 2 + 0.01), dz = onZ ? dnz * (wallD / 2 + 0.01) : 0;
  decoBox(out, cx + dx, baseY + 0.7, cz + dz, onZ ? 0.35 : 0.04, 0.7, onZ ? 0.04 : 0.35, C.doorBrown);
  for (const wf of (o.doorFace === 'north' || o.doorFace === 'south' ? ['east', 'west'] : ['north', 'south']) as ('north' | 'south' | 'east' | 'west')[]) {
    const [wnx, wnz] = faceVec(wf); const oz = Math.abs(wnz) > 0;
    const wx = oz ? 0 : wnx * (wallW / 2 + 0.02), wz = oz ? wnz * (wallD / 2 + 0.02) : 0;
    decoBox(out, cx + wx, baseY + wallH * 0.6, cz + wz, oz ? 0.34 : 0.03, 0.34, oz ? 0.03 : 0.34, C.windowGlow, { emissive: C.windowGlow, emissiveIntensity: 0.6 });
    decoBox(out, cx + wx * 0.99, baseY + wallH * 0.6, cz + wz * 0.99, oz ? 0.4 : 0.05, 0.4, oz ? 0.05 : 0.4, C.windowFrame, { cast: false });
  }
}

/** A floating crag rock — solid, grass-topped, with a rocky underside spike. */
function cragRock(out: WorldData, cx: number, cz: number, topY: number, hx: number, hz: number) {
  solidBox(out, cx, topY - 0.4, cz, hx, 0.4, hz, C.rock, { rough: 1 });
  decoBox(out, cx, topY + 0.03, cz, hx * 0.96, 0.06, hz * 0.96, C.grassDeep, { cast: false });
  decoBox(out, cx, topY + 0.08, cz, hx * 0.6, 0.04, hz * 0.6, C.grass, { cast: false });
  decoCone(out, cx, topY - 1.3, cz, Math.min(hx, hz) * 0.7, 1.6, C.rockDark, { segments: 5, cast: false });
  decoBox(out, cx, topY + 0.06, cz, hx + 0.04, 0.04, hz + 0.04, C.rockDark, { cast: false });
}

/** A soft solid cloud platform — flat collider top + puffy decor overhang. */
function cloudPlatform(out: WorldData, cx: number, cz: number, topY: number, hx: number, hz: number) {
  solidBox(out, cx, topY - 0.18, cz, hx, 0.18, hz, C.cloud, { rough: 1 });
  const r = Math.max(hx, hz);
  decoSphere(out, cx - hx * 0.5, topY - 0.1, cz, r * 0.6, C.cloud, { cast: false });
  decoSphere(out, cx + hx * 0.5, topY - 0.1, cz + hz * 0.2, r * 0.65, C.cloud, { cast: false });
  decoSphere(out, cx, topY - 0.1, cz - hz * 0.5, r * 0.55, C.cloud, { cast: false });
  decoSphere(out, cx - hx * 0.2, topY - 0.05, cz + hz * 0.4, r * 0.4, C.cloudEdge, { cast: false });
}

/** A crystal spire with a flat landable cap at `topY`. */
function crystalSpire(out: WorldData, cx: number, cz: number, topY: number, half: number, height = 2.4, capColor = C.crystalC) {
  const colors = [C.crystalA, C.crystalB, C.crystalC, C.crystalD];
  const c = colors[Math.floor(Math.abs(cx * 7 + cz * 13)) % colors.length];
  solidBox(out, cx, topY - 0.12, cz, half, 0.12, half, capColor, { rough: 0.25 });
  decoCone(out, cx, topY - height / 2 - 0.12, cz, half + 0.15, height, c, { segments: 6, emissive: c, emissiveIntensity: 0.15, cast: false });
  decoCone(out, cx, topY + 0.5, cz, half * 0.6, 0.9, C.crystalB, { segments: 6, emissive: C.crystalB, emissiveIntensity: 0.2, cast: false });
}

/** A free-floating island: solid grass/themed top + a tapering rocky underside
 *  so it reads as a chunk torn from the world and set adrift. `topY` is the
 *  standable surface; `top`/`side` set the district vibe. */
function islet(out: WorldData, cx: number, cz: number, topY: number, hx: number, hz: number, top: string, side: string) {
  solidBox(out, cx, topY - 0.35, cz, hx, 0.35, hz, side, { rough: 1, receive: true });
  decoBox(out, cx, topY + 0.03, cz, hx * 0.97, 0.06, hz * 0.97, top, { cast: false, rough: 0.95 });
  decoBox(out, cx, topY + 0.07, cz, hx * 0.66, 0.04, hz * 0.66, shadeColor(top, 1.1), { cast: false });
  decoBox(out, cx, topY + 0.05, cz, hx + 0.05, 0.05, hz + 0.05, shadeColor(side, 0.8), { cast: false }); // rim
  decoCone(out, cx, topY - 1.5, cz, Math.min(hx, hz) * 0.82, 1.9, side, { segments: 6, cast: false });
  decoCone(out, cx + hx * 0.45, topY - 1.0, cz - hz * 0.3, Math.min(hx, hz) * 0.42, 1.2, shadeColor(side, 0.8), { segments: 5, cast: false });
  decoCone(out, cx - hx * 0.4, topY - 0.9, cz + hz * 0.35, Math.min(hx, hz) * 0.35, 1.0, shadeColor(side, 0.85), { segments: 5, cast: false });
}

// ────────────────────── decor props ──────────────────────

function tree(out: WorldData, x: number, z: number, h: number, kind: 'round' | 'pine' | 'blossom' = 'round') {
  const trunkR = 0.3;
  const trunkC = kind === 'blossom' ? C.treeTrunkLight : C.treeTrunk;
  decoCyl(out, x, h / 2, z, trunkR, h, trunkC, { segments: 10 });
  out.boxes.push({ x, y: h / 2, z, hx: trunkR * 0.85, hy: h / 2, hz: trunkR * 0.85 }); // solid trunk
  if (kind === 'pine') {
    for (let i = 0; i < 4; i++) decoCone(out, x, h + 0.2 + i * 0.7, z, 1.4 - i * 0.25, 1.0, C.treeFolDark, { segments: 10, cast: false });
  } else {
    const fol = kind === 'blossom' ? C.treeBlossom : C.treeFol;
    decoSphere(out, x, h + 0.4, z, 1.25, fol, { cast: false });
    decoSphere(out, x - 0.7, h + 0.2, z + 0.3, 0.95, kind === 'blossom' ? C.treeBlossom : C.treeFol2, { cast: false });
    decoSphere(out, x + 0.6, h + 0.3, z - 0.4, 1.0, fol, { cast: false });
    decoSphere(out, x + 0.1, h + 1.2, z + 0.1, 0.8, kind === 'blossom' ? '#ffe1ec' : C.treeFol2, { cast: false });
  }
}
function lantern(out: WorldData, x: number, baseY: number, z: number, h = 2.2) {
  decoCyl(out, x, baseY + h / 2, z, 0.05, h, C.metal, { cast: false });
  decoSphere(out, x, baseY + h + 0.15, z, 0.18, C.lanternGlow, { emissive: C.lanternGlow, emissiveIntensity: 1.7, cast: false });
}
/** A market-stall canopy: a flat awning held up by four corner posts that stand
 *  on the island surface (`cy`). Without the posts the awning reads as a carpet
 *  floating in mid-air above the stall. */
function stallAwning(out: WorldData, cx: number, cy: number, cz: number, hx: number, hz: number, color: string) {
  const h = 1.6; // canopy clearance / post height above the island
  decoBox(out, cx, cy + h, cz, hx, 0.06, hz, color, { cast: false }); // canopy
  for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const)
    decoCyl(out, cx + sx * (hx - 0.2), cy + h / 2, cz + sz * (hz - 0.2), 0.05, h, C.wood, { cast: false });
}
function mushroom(out: WorldData, x: number, z: number, baseY: number, scale = 1, color: 'red' | 'purple' | 'blue' = 'red') {
  const stemH = 0.4 * scale;
  decoCyl(out, x, baseY + stemH / 2, z, 0.12 * scale, stemH, C.mushStem, { cast: false });
  const cap = color === 'purple' ? C.mushCapPurple : color === 'blue' ? C.mushCapBlue : C.mushCap;
  decoSphere(out, x, baseY + stemH + 0.16 * scale, z, 0.3 * scale, cap, { cast: false });
}
function flowerPatch(out: WorldData, x: number, z: number, baseY: number, count: number, rng: () => number) {
  for (let i = 0; i < count; i++) {
    const fx = x + (rng() * 2 - 1) * 0.7, fz = z + (rng() * 2 - 1) * 0.7, h = 0.15 + rng() * 0.12;
    decoCyl(out, fx, baseY + h / 2, fz, 0.02, h, '#4ade80', { cast: false });
    decoSphere(out, fx, baseY + h + 0.07, fz, 0.08, ['#f43f5e', '#facc15', '#a855f7', '#38bdf8', '#fb923c'][Math.floor(rng() * 5)], { cast: false });
  }
}
function barrel(out: WorldData, x: number, z: number, baseY: number, scale = 1) {
  const r = 0.32 * scale, h = 0.7 * scale;
  decoCyl(out, x, baseY + h / 2, z, r, h, C.wood, { segments: 12 });
  out.boxes.push({ x, y: baseY + h / 2, z, hx: r * 0.85, hy: h / 2, hz: r * 0.85 });
  decoCyl(out, x, baseY + h * 0.8, z, r * 1.04, 0.05, '#1f1308', { segments: 12, cast: false });
}
function haystack(out: WorldData, x: number, z: number, baseY: number, scale = 1) {
  const r = 0.55 * scale, h = 0.55 * scale;
  decoCyl(out, x, baseY + h / 2, z, r, h, C.haystack, { segments: 12 });
  out.boxes.push({ x, y: baseY + h / 2, z, hx: r * 0.85, hy: h / 2, hz: r * 0.85 });
  decoSphere(out, x, baseY + h + 0.04, z, r * 0.7, C.haystack, { cast: false });
}
function fenceRun(out: WorldData, pts: [number, number][]) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const rotY = Math.atan2(dx, dz), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    decoBox(out, cx, 0.7, cz, 0.04, 0.05, len / 2, C.fenceWood, { rotY, cast: false });
    decoBox(out, cx, 0.35, cz, 0.04, 0.05, len / 2, C.fenceWood, { rotY, cast: false });
    const n = Math.max(2, Math.ceil(len / 1.4));
    for (let k = 0; k <= n; k++) decoCyl(out, x1 + dx * (k / n), 0.5, z1 + dz * (k / n), 0.05, 1.0, C.fenceWood, { cast: false });
  }
}
function well(out: WorldData, cx: number, cz: number) {
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; decoBox(out, cx + Math.cos(a) * 0.9, 0.4, cz + Math.sin(a) * 0.9, 0.17, 0.4, 0.17, C.cobble, { rotY: a, cast: false }); }
  out.boxes.push({ x: cx, y: 0.4, z: cz, hx: 0.78, hy: 0.4, hz: 0.78 });
  decoCyl(out, cx, 0.62, cz, 0.62, 0.04, C.waterDeep, { segments: 16, emissive: '#1e3a8a', emissiveIntensity: 0.2, cast: false });
  for (const [sx, sz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]] as const) decoCyl(out, cx + sx, 1.5, cz + sz, 0.07, 1.9, C.wood, { cast: false });
  decoCone(out, cx, 2.7, cz, 1.25, 0.5, C.roofRed, { rotY: Math.PI / 4, segments: 4, cast: false });
}
function campfire(out: WorldData, x: number, z: number, baseY: number) {
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; decoCyl(out, x + Math.cos(a) * 0.3, baseY + 0.12, z + Math.sin(a) * 0.3, 0.06, 0.5, C.woodDark, { rotY: a + 1, cast: false }); }
  decoCone(out, x, baseY + 0.4, z, 0.3, 0.7, C.campfire, { segments: 8, emissive: C.campfire, emissiveIntensity: 1.8, cast: false });
  decoSphere(out, x, baseY + 0.2, z, 0.18, '#fde047', { emissive: '#fbbf24', emissiveIntensity: 2.0, cast: false });
}
function tent(out: WorldData, x: number, z: number, baseY: number, rotY = 0) {
  decoCone(out, x, baseY + 0.9, z, 1.1, 1.9, C.tent, { segments: 4, rotY: rotY + Math.PI / 4, cast: false });
  decoBox(out, x, baseY + 0.5, z + 0.01, 0.25, 0.5, 0.02, '#1f1308', { rotY, cast: false });
}
function pathTile(out: WorldData, x: number, z: number, shade = 1) { decoBox(out, x, 0.02, z, 0.5, 0.02, 0.5, shadeColor(C.cobble, shade), { cast: false }); }

function checkpointBanner(out: WorldData, x: number, y: number, z: number) {
  decoCyl(out, x, y + 1.1, z, 0.06, 2.2, C.woodDark, { cast: false });
  decoBox(out, x + 0.45, y + 1.7, z, 0.42, 0.34, 0.03, C.cpCloth, { emissive: C.cpCloth, emissiveIntensity: 0.3, cast: false });
  decoSphere(out, x, y + 2.3, z, 0.12, C.cpCloth, { emissive: C.cpCloth, emissiveIntensity: 1.3, cast: false });
}

function shadeColor(hex: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.min(255, Math.floor(((n >> 16) & 255) * f)), g = Math.min(255, Math.floor(((n >> 8) & 255) * f)), b = Math.min(255, Math.floor((n & 255) * f));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ════════════════════════════════════════════════════════════════════════
//  THE WORLD
// ════════════════════════════════════════════════════════════════════════

export function generateWorld(seed = 1337): WorldData {
  const rng = makeRng(seed);
  const out: WorldData = {
    boxes: [], ladders: [], movers: [], breakaways: [], meshes: [], windmills: [], flags: [], smoke: [],
    waterfalls: [], waterwheels: [], checkpoints: [], zones: [], edges: [],
    goal: { x: 0, y: 0, z: 0 }, summitY: 0, maxHeight: 0,
  };

  out.zones = [
    { name: 'Garden Rise', minY: -5, tint: '#9be37c' },
    { name: 'Windmill Heights', minY: 11, tint: '#e3c970' },
    { name: 'The Waterworks', minY: 23, tint: '#7fc5a9' },
    { name: 'Night Market', minY: 28, tint: '#e0883a' },
    { name: 'Ice Reach', minY: 30, tint: '#cfeeff' },
    { name: 'The Summit', minY: 45, tint: '#c4b5fd' },
  ];

  // ── HOME ISLAND — the floating village you launch from ──
  islet(out, 0, 0, 0, 15, 15, C.grass, C.dirtDark);
  // slender DECORATIVE central peak the climb spirals around (NO collider, so the
  // chase camera never jams on it — it's just a landmark in the open middle).
  decoCyl(out, 0, 7, 0, 2.8, 14, '#8f8d92', { segments: 8 });
  decoCyl(out, 0, 22, 0, 2.2, 16, '#9b9aa1', { segments: 8 });
  decoCyl(out, 0, 37, 0, 1.7, 16, '#b4bac2', { segments: 8 });
  decoCone(out, 0, 51, 0, 1.5, 10, '#d6dee6', { segments: 8 });
  decoCone(out, 0, 58.5, 0, 1.0, 5, '#eef4f8', { segments: 8 });
  // village on the home island
  const cotColors: Array<[string, string]> = [[C.wallMint, C.roofTeal], [C.wallSky, C.roofCoral], [C.wallPink, C.roofLav], [C.wallPeach, C.roofPlum], [C.wallCream, C.roofRed]];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 1.2, cr = 10.5, cx = Math.cos(a) * cr, cz = Math.sin(a) * cr;
    const door: 'north' | 'south' | 'east' | 'west' = Math.abs(cx) > Math.abs(cz) ? (cx > 0 ? 'west' : 'east') : (cz > 0 ? 'north' : 'south');
    cottage(out, { cx, cz, baseY: 0, wallW: 3.2, wallD: 3.0, wallH: 2.3, wallColor: cotColors[i][0], roofColor: cotColors[i][1], doorFace: door });
  }
  well(out, 5.5, 5.5);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.3; tree(out, Math.cos(a) * 12.5, Math.sin(a) * 12.5, 4 + (i % 2), (['round', 'pine', 'blossom'] as const)[i % 3]); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; lantern(out, Math.cos(a) * 7.5, 0, Math.sin(a) * 7.5, 2.0); }
  for (let i = 0; i < 16; i++) { const a = rng() * Math.PI * 2, rr = 4 + rng() * 9; flowerPatch(out, Math.cos(a) * rr, Math.sin(a) * rr, 0, 5, rng); mushroom(out, -Math.cos(a) * rr, -Math.sin(a) * rr, 0, 0.6 + rng() * 0.5, rng() > 0.6 ? 'purple' : 'red'); }

  // ── district palettes + skins ──
  const PAL = {
    garden: { top: C.grass, side: C.dirtDark },
    wheat: { top: '#e3c970', side: '#a8893f' },
    water: { top: '#7fc5a9', side: '#566d70' },
    market: { top: '#c69a5e', side: '#6b5a45' },
    ice: { top: '#cfeeff', side: '#8fb0c0' },
  };
  const isle = (p: { top: string; side: string }) => (cx: number, cz: number, topY: number, hx: number, hz: number) => islet(out, cx, cz, topY, hx, hz, p.top, p.side);
  const ice = (cx: number, cz: number, topY: number, hx: number, hz: number) => iceBreakaway(out, cx, cz, topY, hx, hz);
  const crys = (cap: string) => (cx: number, cz: number, topY: number, hx: number, hz: number) => crystalSpire(out, cx, cz, topY, Math.min(hx, hz), 2.4, cap);
  const R0 = 9.5; // spiral orbit radius (islands float this far from the open centre)

  const r = new Route(out, { x: 0, y: 0.6, z: R0, hx: 1.6, hz: 1.6, label: 'spine' });
  r.angle = Math.PI / 2;
  islet(out, 0, R0, 0.6, 1.6, 1.6, C.grass, C.dirtDark); // trailhead islet at the home edge
  const dress = (flag: string, lamp = false) => {
    const ox = Math.cos(r.angle), oz = Math.sin(r.angle);
    // Stand the flag on a pole set on the island lip (inset from the edge).
    // Dropping the banner just past the edge at +0.5 left it floating / clipping
    // through the platform below ("flag sticking through the ground").
    const fx = r.x + ox * (r.hx - 0.4), fz = r.z + oz * (r.hz - 0.4);
    decoCyl(out, fx, r.y + 0.8, fz, 0.05, 1.6, C.woodDark, { cast: false });
    out.flags.push({ x: fx, y: r.y + 1.45, z: fz, rotY: r.angle, color: flag });
    if (lamp) lantern(out, r.x - ox * (r.hx - 0.3), r.y, r.z - oz * (r.hz - 0.3), 1.5);
  };
  // ════ DISTRICT 1 — GARDEN RISE (committed single jumps onto small islands) ════
  r.arc({ dDeg: 32, R: R0, rise: 1.7, hx: 1.0, hz: 1.0, band: 'medium', skin: isle(PAL.garden) });
  const scA = { x: r.x, y: r.y, z: r.z, hx: r.hx, hz: r.hz };  // shortcut launch
  r.arc({ dDeg: 30, R: R0, rise: 1.0, hx: 0.9, hz: 0.9, band: 'medium', skin: isle(PAL.garden) });
  r.arc({ dDeg: 30, R: R0, rise: 1.0, hx: 0.9, hz: 0.9, band: 'medium', skin: isle(PAL.garden) });
  // SHORTCUT: skip the two stepping islands with one big double across the drop.
  out.edges.push({ ax: scA.x, ay: scA.y, az: scA.z, bx: r.x, by: r.y, bz: r.z, band: 'double', kind: 'shortcut' });
  tree(out, r.x, r.z - 0.1, 1.5, 'blossom');
  r.arc({ dDeg: 36, R: R0, rise: 1.9, hx: 0.95, hz: 0.95, band: 'medium', skin: isle(PAL.garden) });
  r.arc({ dDeg: 32, R: R0, rise: 1.6, hx: 1.6, hz: 1.4, band: 'medium', skin: isle(PAL.garden) });
  r.checkpoint('Garden Rise', 1); dress(C.flag4, true);

  // ════ DISTRICT 2 — WINDMILL HEIGHTS (long, low, precise jumps + the WHEEL) ════
  r.arc({ dDeg: 44, R: R0, rise: 1.0, hx: 0.85, hz: 0.85, band: 'hard', skin: isle(PAL.wheat) }); // long flat leap
  r.arc({ dDeg: 40, R: R0, rise: 1.4, hx: 0.85, hz: 0.85, band: 'hard', skin: isle(PAL.wheat) });
  // THE GONDOLA WHEEL — time the board, ride a gondola up, hop off at the top.
  {
    const ahead = r.angle + 0.42;
    const px = Math.cos(ahead) * R0, pz = Math.sin(ahead) * R0, py = r.y + 4.4;
    const w = gondolaWheel(out, { x: px, y: py, z: pz }, 4.0, 4, 7, C.plank); // faster (period 7)
    r.link(w.bottom.x, w.bottom.y, w.bottom.z, 1.1, 1.1, 'hard', 'jump');
    out.edges.push({ ax: w.bottom.x, ay: w.bottom.y, az: w.bottom.z, bx: w.top.x, by: w.top.y, bz: w.top.z, band: 'easy', kind: 'mover' });
    r.x = w.top.x; r.y = w.top.y; r.z = w.top.z; r.hx = 1.1; r.hz = 1.1; r.angle = ahead;
  }
  r.arc({ dDeg: 34, R: R0, rise: 0.2, hx: 1.4, hz: 1.3, band: 'medium', skin: isle(PAL.wheat) }); // hop off the wheel top
  r.checkpoint('Windmill Heights', 2); dress(C.flag3);

  // ════ DISTRICT 3 — THE WATERWORKS (hard precise leaps + a fast WATER-LIFT) ════
  r.arc({ dDeg: 46, R: R0, rise: 0.8, hx: 0.8, hz: 0.8, band: 'hard', skin: isle(PAL.water) }); // near the single-jump limit
  r.arc({ dDeg: 42, R: R0, rise: 1.2, hx: 0.8, hz: 0.8, band: 'hard', skin: isle(PAL.water) });
  // a fast rising WATER-LIFT — board it on the spiral, ride up (tight window)
  {
    const la = r.angle + (24 * Math.PI) / 180, lx = Math.cos(la) * R0, lz = Math.sin(la) * R0;
    const llow = r.y - 0.1, lhigh = r.y + 4.8;
    mover(out, { ax: lx, ay: llow, az: lz, bx: lx, by: lhigh, bz: lz, hx: 1.2, hy: 0.18, hz: 1.2, period: 4, color: C.water, style: 'lift' });
    r.link(lx, llow + 0.18, lz, 1.2, 1.2, 'hard', 'jump');
    out.edges.push({ ax: lx, ay: llow + 0.18, az: lz, bx: lx, by: lhigh + 0.18, bz: lz, band: 'easy', kind: 'mover' });
    r.x = lx; r.y = lhigh + 0.18; r.z = lz; r.hx = 1.2; r.hz = 1.2; r.angle = la;
  }
  r.arc({ dDeg: 38, R: R0, rise: 1.2, hx: 1.5, hz: 1.4, band: 'hard', skin: isle(PAL.water) });
  dress(C.flag2, true); // Waterworks checkpoint removed — the water district stays as a flagged landmark

  // ════ DISTRICT 4 — THE NIGHT MARKET (CONVERGING CARGO CARTS + a daredevil double) ════
  r.arc({ dDeg: 42, R: R0, rise: 1.2, hx: 1.3, hz: 1.3, band: 'hard', skin: isle(PAL.market) });
  // lantern-strung market island
  for (let i = 0; i < 3; i++) lantern(out, r.x + (i - 1) * 0.8, r.y, r.z - 0.6, 1.3);
  stallAwning(out, r.x, r.y, r.z, 1.4, 1.0, C.roofCoral); // lantern-strung stall canopy
  // CONVERGING CARTS: ride cart A out, transfer to cart B as they converge, ride
  // to the far island. They meet in the middle on a cycle — mistime the transfer
  // and you're left on a cart that carries you back (or shoved off).
  {
    // Lane runs between the near island and a FAR island further around the
    // spiral (both solid footholds), so the dismount lands cleanly on-ring.
    const nx = r.x, nz = r.z, ly = r.y + 0.5;
    const eAng = r.angle + (66 * Math.PI) / 180;
    const fx = Math.cos(eAng) * R0, fz = Math.sin(eAng) * R0, fyTop = ly; // level with the carts → clean step-off, no overhang
    islet(out, fx, fz, fyTop, 1.8, 1.6, PAL.market.top, PAL.market.side); // FAR market island (solid)
    const dx = fx - nx, dz = fz - nz, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
    const mx = (nx + fx) / 2, mz = (nz + fz) / 2;
    // cart A: near-side → just before mid ; cart B: far-side → just after mid.
    // Same period/phase → both reach the middle together (the "smash"); transfer
    // across the 2.6 m gap only in that window, or ride back and retry.
    mover(out, { ax: nx + ux * 2.6, ay: ly, az: nz + uz * 2.6, bx: mx - ux * 1.3, by: ly, bz: mz - uz * 1.3, hx: 1.2, hy: 0.16, hz: 1.2, period: 3.6, color: C.woodLight, style: 'cart' });
    mover(out, { ax: fx - ux * 2.6, ay: ly, az: fz - uz * 2.6, bx: mx + ux * 1.3, by: ly, bz: mz + uz * 1.3, hx: 1.2, hy: 0.16, hz: 1.2, period: 3.6, color: C.woodLight, style: 'cart' });
    r.link(nx + ux * 2.6, ly + 0.16, nz + uz * 2.6, 1.2, 1.2, 'hard', 'jump');     // board cart A
    out.edges.push({ ax: nx + ux * 2.6, ay: ly + 0.16, az: nz + uz * 2.6, bx: mx - ux * 1.3, by: ly + 0.16, bz: mz - uz * 1.3, band: 'easy', kind: 'mover' });
    out.edges.push({ ax: mx - ux * 1.3, ay: ly + 0.16, az: mz - uz * 1.3, bx: mx + ux * 1.3, by: ly + 0.16, bz: mz + uz * 1.3, band: 'medium', kind: 'jump' }); // transfer A→B
    out.edges.push({ ax: mx + ux * 1.3, ay: ly + 0.16, az: mz + uz * 1.3, bx: fx - ux * 2.6, by: ly + 0.16, bz: fz - uz * 2.6, band: 'easy', kind: 'mover' }); // ride B
    out.edges.push({ ax: fx - ux * 2.6, ay: ly + 0.16, az: fz - uz * 2.6, bx: fx, by: fyTop, bz: fz, band: 'medium', kind: 'jump' }); // step onto far island
    // SHORTCUT: skip the whole cart dance with one huge double straight across the gap.
    out.edges.push({ ax: nx, ay: ly - 0.5, az: nz, bx: fx, by: fyTop, bz: fz, band: 'double', kind: 'shortcut' });
    r.x = fx; r.y = fyTop; r.z = fz; r.hx = 1.8; r.hz = 1.6; r.angle = eAng;
  }
  r.checkpoint('Night Market', 4); dress(C.flag1, true);
  stallAwning(out, r.x, r.y, r.z - 0.4, 1.5, 1.1, C.roofTeal); // market checkpoint stall canopy

  // ════ DISTRICT 5 — ICE REACH (BRUTAL: tiny fast-cracking ice + a forced double) ════
  r.arc({ dDeg: 38, R: R0, rise: 1.2, hx: 1.0, hz: 1.0, band: 'hard', skin: isle(PAL.ice) });
  // a sprint across tiny CRACKING ICE — each cracks ~0.34 s after you land, so you
  // can NOT stop. Small pads, near-limit gaps.
  r.arc({ dDeg: 30, R: R0, rise: 0.8, hx: 0.7, hz: 0.7, band: 'hard', skin: ice });
  r.arc({ dDeg: 30, R: R0, rise: 0.8, hx: 0.6, hz: 0.6, band: 'hard', skin: ice });
  r.arc({ dDeg: 30, R: R0, rise: 0.8, hx: 0.6, hz: 0.6, band: 'hard', skin: ice });
  r.arc({ dDeg: 30, R: R0, rise: 0.8, hx: 0.7, hz: 0.7, band: 'hard', skin: ice });
  r.arc({ dDeg: 32, R: R0, rise: 1.4, hx: 1.4, hz: 1.3, band: 'hard', skin: isle(PAL.ice) }); // solid breather
  r.checkpoint('Ice Reach', 5); dress(C.flag5, true); // last respawn before the crown of doubles
  decoCone(out, r.x + 1.4, r.y + 0.9, r.z, 0.4, 1.6, C.crystalC, { segments: 6, emissive: C.crystalC, emissiveIntensity: 0.3, cast: false });
  // ════ THE CROWN — five forced double-jumps for players who've mastered the
  //     double: each leg is longer than anything below (unreachable by a single
  //     jump, so the double is mandatory) and climbs to a higher, further beacon.
  r.arc({ dDeg: 52, R: R0, rise: 2.8, hx: 0.85, hz: 0.85, band: 'double', skin: crys(C.crystalA) });
  r.arc({ dDeg: 50, R: R0, rise: 2.8, hx: 0.85, hz: 0.85, band: 'double', skin: crys(C.crystalC) });
  r.arc({ dDeg: 52, R: R0, rise: 2.9, hx: 0.85, hz: 0.85, band: 'double', skin: crys(C.crystalD) });
  r.arc({ dDeg: 50, R: R0, rise: 2.8, hx: 0.85, hz: 0.85, band: 'double', skin: crys(C.crystalB) });
  r.arc({ dDeg: 52, R: R0, rise: 2.8, hx: 0.85, hz: 0.85, band: 'double', skin: crys(C.crystalA) });

  // ════ SUMMIT — a beacon island at the peak's shoulder ════
  r.arc({ dDeg: 30, R: R0 - 2, rise: 1.4, hx: 2.2, hz: 2.2, band: 'hard', skin: isle({ top: '#eef4f8', side: '#b4bac2' }) });
  const sX = r.x, sY = r.y, sZ = r.z;
  decoCyl(out, sX, sY + 0.5, sZ, 1.0, 1.0, C.crystalB, { segments: 8, emissive: C.crystalB, emissiveIntensity: 0.2, cast: false });
  decoCone(out, sX, sY + 1.6, sZ, 1.2, 1.2, C.crystalA, { segments: 8, emissive: C.crystalA, emissiveIntensity: 0.25, cast: false });
  out.goal = { x: sX, y: sY + 2.6, z: sZ };
  out.summitY = sY;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; out.flags.push({ x: sX + Math.cos(a) * 1.9, y: sY + 0.3, z: sZ + Math.sin(a) * 1.9, rotY: a, color: [C.flag1, C.flag2, C.flag3, C.flag4, C.flag5][i % 5] }); }

  out.maxHeight = out.goal.y;
  return out;
}

// ────────────────────── spawn points ──────────────────────

/** Spawn ring around the foot of the spire — players gather all around the
 *  base and funnel up onto the trailhead terrace to start the spiral. */
export const SPAWN_POINTS: ReadonlyArray<readonly [number, number, number]> =
  Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return [Math.round(Math.cos(a) * 13 * 100) / 100, 1, Math.round(Math.sin(a) * 13 * 100) / 100] as readonly [number, number, number];
  });

export function spawnFor(socketId: string): { x: number; y: number; z: number } {
  let h = 0;
  for (let i = 0; i < socketId.length; i++) h = (h * 31 + socketId.charCodeAt(i)) >>> 0;
  const [x, y, z] = SPAWN_POINTS[h % SPAWN_POINTS.length];
  return { x, y, z };
}
