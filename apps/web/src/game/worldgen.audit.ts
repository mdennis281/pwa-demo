/* eslint-disable no-console */
// ════════════════════════════════════════════════════════════════════════
//  WORLD AUDIT — deterministic, physics-accurate verification of the world.
//
//  Run:  node_modules/.bin/tsx apps/web/src/game/worldgen.audit.ts
//
//  Checks, independent of the RouteBuilder's own asserts:
//   1. Generation succeeds (RouteBuilder didn't throw an unreachable hop).
//   2. Every jump edge is inside the single/double-jump envelope.
//   3. Every foothold has ≥ player-height head clearance (no head-bumps).
//   4. Checkpoints cover the climb (no zone gap > ~16 m without a respawn).
//   5. Draw-call budget: meshes pre-merge vs. distinct material signatures.
//  Exits non-zero if any hard check fails.
// ════════════════════════════════════════════════════════════════════════
import { generateWorld, BANDS, type Band, type Edge, type WorldData } from './worldgen';
import { PLAYER, type Box } from './physics';

const G = 28, VJ = 13, SPEED = 7;
const HEAD = PLAYER.height;      // 1.6
const RXZ = PLAYER.rxz;          // 0.4

function reachSingle(dh: number): number {
  const disc = VJ * VJ - 2 * G * dh;
  if (disc < 0) return 0;
  return SPEED * ((VJ + Math.sqrt(disc)) / G);
}
// Generous double-jump horizontal reach model: longer hang time + second pop.
function reachDouble(dh: number): number {
  // airtime to fall back to dh after a jump+ (second jump near apex, vy→10).
  // upper bound on hang time ≈ (VJ + 10)/G * 1.15 ; horizontal = SPEED * t.
  const t = ((VJ + 10) / G) * 1.1;
  void dh;
  return SPEED * t; // ≈ 6.3 m
}

let errors = 0, warns = 0;
const err = (m: string) => { console.error('  ✗ ' + m); errors++; };
const warn = (m: string) => { console.warn('  ! ' + m); warns++; };
const ok = (m: string) => console.log('  ✓ ' + m);

let w: WorldData;
try {
  w = generateWorld(1337);
} catch (e) {
  console.error('GENERATION FAILED (a hop was unreachable):');
  console.error(String(e));
  process.exit(1);
}

console.log('\n══ TOWER CLIMB WORLD AUDIT ══\n');
console.log(`summitY=${w.summitY.toFixed(2)}  beacon=(${w.goal.x.toFixed(1)}, ${w.goal.y.toFixed(1)}, ${w.goal.z.toFixed(1)})  maxHeight=${w.maxHeight.toFixed(2)}`);
console.log(`meshes=${w.meshes.length}  colliders=${w.boxes.length}  ladders=${w.ladders.length}  movers=${w.movers.length}  edges=${w.edges.length}`);

// ── 1. Reachability of jump edges ─────────────────────────────────────────
console.log('\n[1] Jump reachability');
const jumpKinds = new Set<Edge['kind']>(['walk', 'jump', 'double', 'shortcut']);
let jumpEdges = 0;
for (const e of w.edges) {
  if (!jumpKinds.has(e.kind)) continue;
  jumpEdges++;
  const rise = e.by - e.ay;
  const centerDist = Math.hypot(e.bx - e.ax, e.bz - e.az);
  const b = BANDS[e.band as Band];
  if (rise > b.dh + 0.05) err(`edge ${e.kind}/${e.band}: rise ${rise.toFixed(2)}m > band dh ${b.dh}m  @ (${e.ax.toFixed(1)},${e.ay.toFixed(1)},${e.az.toFixed(1)})→(${e.bx.toFixed(1)},${e.by.toFixed(1)},${e.bz.toFixed(1)})`);
  // center distance includes both platform halves, so allow generous slack vs. edge envelope.
  const envelope = (b.jumps === 2 ? reachDouble(Math.max(0, rise)) : reachSingle(Math.max(0, rise)));
  const maxCenter = envelope + 4.4; // ~both half-extents
  if (rise >= 0 && centerDist > maxCenter) err(`edge ${e.kind}/${e.band}: centre-dist ${centerDist.toFixed(2)}m implausible vs envelope ${envelope.toFixed(2)}m (rise ${rise.toFixed(2)})  @ (${e.ax.toFixed(1)},${e.ay.toFixed(1)},${e.az.toFixed(1)})`);
}
if (errors === 0) ok(`${jumpEdges} jump/walk/double/shortcut edges within envelope`);

// ── 2. Head clearance at every foothold ───────────────────────────────────
console.log('\n[2] Head clearance (≥ ' + HEAD + 'm above every foothold)');
type Pt = { x: number; y: number; z: number; tag: string };
const footholds: Pt[] = [];
for (const e of w.edges) {
  footholds.push({ x: e.ax, y: e.ay, z: e.az, tag: `${e.kind} start` });
  footholds.push({ x: e.bx, y: e.by, z: e.bz, tag: `${e.kind} end` });
}
// also the checkpoints + summit
for (const c of w.checkpoints) footholds.push({ x: c.x, y: c.y, z: c.z, tag: `cp:${c.name}` });
footholds.push({ x: w.goal.x, y: w.summitY, z: w.goal.z, tag: 'summit' });

const HEAD_LO = 0.06, HEAD_HI = HEAD - 0.05, PAD = RXZ + 0.02;
let headChecks = 0, headBumps = 0;
for (const p of footholds) {
  headChecks++;
  for (const bx of w.boxes as Box[]) {
    const topY = bx.y + bx.hy, botY = bx.y - bx.hy;
    // box intrudes into the head space above this foothold?
    const vert = botY < p.y + HEAD_HI && topY > p.y + HEAD_LO;
    if (!vert) continue;
    const overX = Math.abs(p.x - bx.x) < bx.hx + PAD;
    const overZ = Math.abs(p.z - bx.z) < bx.hz + PAD;
    if (overX && overZ) {
      headBumps++;
      err(`head-bump @ ${p.tag} (${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}): collider top=${topY.toFixed(2)} bot=${botY.toFixed(2)} centre=(${bx.x.toFixed(1)},${bx.y.toFixed(1)},${bx.z.toFixed(1)}) hx=${bx.hx} hz=${bx.hz}`);
      break;
    }
  }
}
if (headBumps === 0) ok(`${headChecks} footholds all have clear head room`);

// ── 3. Checkpoint coverage ─────────────────────────────────────────────────
console.log('\n[3] Checkpoint coverage');
const cps = [...w.checkpoints].sort((a, b) => a.y - b.y);
console.log('  checkpoints: ' + cps.map(c => `${c.name}@${c.y.toFixed(0)}m`).join('  '));
let prevY = 0;
for (const c of cps) {
  const gap = c.y - prevY;
  if (gap > 16.5) warn(`checkpoint gap ${gap.toFixed(1)}m before "${c.name}" (>16.5m climb without respawn)`);
  prevY = c.y;
}
const toSummit = w.summitY - prevY;
if (toSummit > 18) warn(`final stretch to summit is ${toSummit.toFixed(1)}m from last checkpoint`);
if (warns === 0) ok('checkpoints evenly spaced up the climb');

// ── 4. Draw-call budget (pre-merge vs distinct material signatures) ────────
console.log('\n[4] Draw-call budget');
const sigs = new Set<string>();
for (const m of w.meshes) {
  const mm = m as Record<string, unknown>;
  const sig = [mm.color, mm.roughness ?? 0.85, mm.emissive ?? '', mm.emissiveIntensity ?? 0, mm.cast ?? true, ('receive' in mm ? mm.receive : true)].join('|');
  sigs.add(sig);
}
console.log(`  static meshes (pre-merge draw calls): ${w.meshes.length}`);
console.log(`  distinct material signatures (post-merge static draw calls): ${sigs.size}`);
console.log(`  + dynamic nodes: movers ${w.movers.length}, flags ${w.flags.length}, smoke ${w.smoke.length}, windmills ${w.windmills.length}, waterfalls ${w.waterfalls.length}, wheels ${w.waterwheels.length}, ladders ${w.ladders.length}`);
if (sigs.size > 180) warn(`post-merge static draw calls ${sigs.size} is high — consider consolidating colours`);
else ok(`post-merge static draw calls ≈ ${sigs.size}`);

// ── 5. Monotonic spine summary ─────────────────────────────────────────────
console.log('\n[5] Spine altitude progression (jump/mover/ladder edges)');
const spine = w.edges.filter(e => e.by - e.ay > 0.3);
let lo = Infinity, hi = -Infinity;
for (const e of spine) { lo = Math.min(lo, e.ay); hi = Math.max(hi, e.by); }
console.log(`  spine spans y=${lo.toFixed(1)} → y=${hi.toFixed(1)} over ${spine.length} rising edges`);

console.log('\n[6] Centrality (how tower-like — horizontal distance from world centre)');
for (const c of cps) console.log(`  ${c.name.padEnd(18)} @ y${c.y.toFixed(0).padStart(2)}  r=${Math.hypot(c.x, c.z).toFixed(1)}m  (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
console.log(`  ${'SUMMIT'.padEnd(18)} @ y${w.summitY.toFixed(0)}  r=${Math.hypot(w.goal.x, w.goal.z).toFixed(1)}m  (${w.goal.x.toFixed(1)}, ${w.goal.z.toFixed(1)})`);
let maxR = 0; for (const e of w.edges) maxR = Math.max(maxR, Math.hypot(e.bx, e.bz));
console.log(`  max foothold radius across whole climb: ${maxR.toFixed(1)}m`);
if (maxR > 30) warn(`climb drifts ${maxR.toFixed(1)}m from centre — not very tower-like (target ≤ ~22m)`);

console.log(`\n══ RESULT: ${errors} errors, ${warns} warnings ══\n`);
process.exit(errors > 0 ? 1 : 0);
