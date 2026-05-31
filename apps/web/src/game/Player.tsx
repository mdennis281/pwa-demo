import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Character from './Character';
import { input, consumeJump } from './controls/input';
import { PLAYER, rayHitDistance, stepPlayer } from './physics';
import type { Box } from './physics';
import { BREAK_DELAY_MS, BREAK_RESPAWN_MS } from './worldgen';
import type { Mover, Checkpoint, Breakaway } from './worldgen';
import type { LocalInput } from '@pwa-demo/shared';

const MOVE_SPEED = 7.0;
const AIR_CONTROL = 0.55;          // 0..1 multiplier on air-direction authority
const JUMP_SPEED = 13;             // ~3.0m apex (squared/56)
const DOUBLE_JUMP_SPEED = 10;      // adds ~1.8m at apex if perfectly timed
const GRAVITY = 28;
const VAR_JUMP_CUT = 0.45;         // multiplier when releasing jump early
const COYOTE_MS = 120;
const BUFFER_MS = 110;
const MAX_JUMPS = 2;
const CLIMB_SPEED = 4;             // ladder vertical speed (m/s)
const LADDER_RELEASE_MS = 220;     // after jumping off a ladder, gravity stays on this long
const FLY_SPEED = 14;              // cheat: free-fly speed

const CAMERA_LERP_TAU = 0.001;          // very snappy positional catch-up (was 0.07)
const CAMERA_MIN_DIST = 1.2;
const CAMERA_PAD = 0.4;
/** Max angular speed the camera may orbit the player (rad/sec). Below this
 *  threshold the camera tracks the mouse instantly — no smoothing, no lag.
 *  Above it, the camera lags behind and arcs around the orbit ring at this
 *  rate. This is what prevents the "view flips the wrong way" glitch on fast
 *  mouse flicks: smoothing the *angle* keeps the target on the orbit ring, so
 *  the position lerp never chord-cuts through the player. ~3 turns/sec. */
const CAMERA_MAX_ANG_SPEED = Math.PI * 6;
const SEND_HZ = 20;

const _camTarget = new THREE.Vector3();

function onLadderVolume(x: number, y: number, z: number, ladders: Box[]): boolean {
  for (const l of ladders) {
    if (Math.abs(x - l.x) < l.hx + PLAYER.rxz &&
        Math.abs(z - l.z) < l.hz + PLAYER.rxz &&
        y + PLAYER.height > l.y - l.hy &&
        y < l.y + l.hy) {
      return true;
    }
  }
  return false;
}

/** Compute a mover's current world position from time-synced wall clock.
 *  Stores the previous position so Player can carry riders. */
function tickMover(m: Mover): void {
  m.prevX = m.x; m.prevY = m.y; m.prevZ = m.z;
  const t = Date.now() / 1000;
  if (m.orbit) {
    // continuous rotation around a pivot in the x-y plane (a turning wheel)
    const ang = (t / m.period + m.phase) * Math.PI * 2;
    m.x = m.orbit.px + Math.cos(ang) * m.orbit.radius;
    m.y = m.orbit.py + Math.sin(ang) * m.orbit.radius;
    m.z = m.orbit.pz;
    return;
  }
  const phase = ((t / m.period + m.phase) % 1 + 1) % 1; // 0..1
  const s = (1 - Math.cos(phase * Math.PI * 2)) / 2;    // 0..1..0 (sine ease)
  m.x = m.ax + (m.bx - m.ax) * s;
  m.y = m.ay + (m.by - m.ay) * s;
  m.z = m.az + (m.bz - m.az) * s;
}

/** Recycle expired breakaways back to solid. */
function tickBreakaways(breaks: Breakaway[], now: number): void {
  for (const b of breaks) if (b.triggeredAt >= 0 && now >= b.triggeredAt + BREAK_RESPAWN_MS) b.triggeredAt = -1;
}
/** A breakaway is solid (collidable) while idle or still cracking. */
function breakawaySolid(b: Breakaway, now: number): boolean {
  return b.triggeredAt < 0 || now < b.triggeredAt + BREAK_DELAY_MS;
}

/** Find which mover the player is standing on, if any. Returns -1 if none.
 *  Only platform-kind movers carry; wall-kind hazards are skipped so the
 *  player can briefly stand on a wall top but doesn't get whisked along. */
function moverUnderfoot(x: number, y: number, z: number, movers: Mover[]): number {
  for (let i = 0; i < movers.length; i++) {
    const m = movers[i];
    if (m.kind === 'wall') continue;
    const topY = m.y + m.hy;
    // Tolerance absorbs a frame of float rounding / brief slow-fall so a rider
    // isn't dropped (which would let the next sweep shove them off sideways).
    if (y > topY - 0.14 && y < topY + 0.05 &&
        Math.abs(x - m.x) < m.hx + PLAYER.rxz &&
        Math.abs(z - m.z) < m.hz + PLAYER.rxz) {
      return i;
    }
  }
  return -1;
}

export default function Player({
  variant,
  boxes,
  ladders,
  movers,
  breakaways,
  spawn,
  cheats,
  fly,
  paused,
  goal,
  checkpoints,
  onInput,
  onDoubleJump,
  onJumpsChange,
  onReachSummit,
  onCheckpoint,
}: {
  variant: number;
  boxes: Box[];
  ladders: Box[];
  movers: Mover[];
  breakaways: Breakaway[];
  spawn: { x: number; y: number; z: number };
  cheats: { fly: boolean; infiniteJumps: boolean };
  /** Active flight (dev cheat OR earned summit reward). capY/minY clamp the
   *  vertical range; leashR softly tethers you to the map horizontally. */
  fly: { active: boolean; capY: number; minY: number; leashR: number };
  /** When true the game is paused: freeze physics, camera, and input send. */
  paused: boolean;
  goal: { x: number; y: number; z: number };
  checkpoints: Checkpoint[];
  onInput: (i: LocalInput) => void;
  onDoubleJump?: () => void;
  onJumpsChange?: (used: number) => void;
  onReachSummit?: () => void;
  onCheckpoint?: (name: string, zone: number) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const spawnRef = useRef(spawn);
  // Respawn anchor: starts at spawn, upgrades to the highest checkpoint reached.
  const respawnRef = useRef(spawn);
  const reachedCpRef = useRef(-Infinity);
  const summitDoneRef = useRef(false);
  const stateRef = useRef({
    x: spawn.x, y: spawn.y, z: spawn.z,
    vx: 0, vy: 0, vz: 0,
    grounded: false,
    visualYaw: 0,
    state: 'idle' as 'idle' | 'run' | 'air',
    jumpsUsed: 0,
    lastGroundedAt: -Infinity,
    bufferedJumpUntil: -Infinity,
    wasJumpHeld: false,
    lastJumpAt: -Infinity,
    mountedMoverIdx: -1,
    // Camera-specific yaw/pitch that lag behind the mouse only when the user
    // flicks faster than CAMERA_MAX_ANG_SPEED. NaN = "first frame, snap."
    camYaw: NaN, camPitch: NaN,
  });
  const lastSendRef = useRef(0);
  const { camera } = useThree();

  useEffect(() => {
    spawnRef.current = spawn;
    if (reachedCpRef.current === -Infinity) respawnRef.current = spawn;
  }, [spawn]);

  useEffect(() => {
    camera.position.set(spawn.x, spawn.y + 5, spawn.z + 10);
    camera.lookAt(spawn.x, spawn.y + 1, spawn.z);
    // initial camera yaw faces the world center for a friendlier start
    const dx = -spawn.x;
    const dz = -spawn.z;
    input.yaw = Math.atan2(dx, dz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useFrame((state, dt) => {
    const s = stateRef.current;
    // Paused — fully frozen. No physics, no camera follow, no network send.
    // We only drain the jump *press* latch so a tap during the pause doesn't
    // fire on resume; movement keys are left alone (they track the real key
    // state via useKeyboard) so a player who held W through the pause keeps
    // moving on resume instead of having to release and re-press.
    if (paused) {
      input.jumpPressed = false;
      return;
    }
    const cdt = Math.min(dt, 0.05);
    const now = state.clock.elapsedTime * 1000;

    // ── FLY — bypass physics and move freely (dev cheat OR earned reward) ──
    if (fly.active) {
      const yaw = input.yaw;
      const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
      const moveX = rightX * input.right + fwdX * input.forward;
      const moveZ = rightZ * input.right + fwdZ * input.forward;
      const mag = Math.hypot(moveX, moveZ);
      let vx = 0, vz = 0;
      if (mag > 0) {
        vx = (moveX / mag) * FLY_SPEED;
        vz = (moveZ / mag) * FLY_SPEED;
      }
      let vy = (input.jumpHeld ? FLY_SPEED : 0) - (input.descendHeld ? FLY_SPEED : 0);
      s.x += vx * cdt;
      s.y += vy * cdt;
      s.z += vz * cdt;
      // Ceiling just above the summit so flight is a victory lap, not an escape.
      if (s.y > fly.capY) { s.y = fly.capY; if (vy > 0) vy = 0; }
      if (s.y < fly.minY) { s.y = fly.minY; if (vy < 0) vy = 0; }
      // Soft horizontal leash back toward the world centre.
      const rad = Math.hypot(s.x, s.z);
      if (rad > fly.leashR) { const k = fly.leashR / rad; s.x *= k; s.z *= k; }
      s.vx = vx; s.vy = vy; s.vz = vz;
      s.grounded = false;
      s.jumpsUsed = 0;
      s.mountedMoverIdx = -1;

      // visual rotation toward movement
      if (mag > 0.1) {
        const target = Math.atan2(moveX, moveZ);
        const diff = wrapPi(target - s.visualYaw);
        s.visualYaw += diff * Math.min(1, cdt * 12);
      }
      if (ref.current) {
        ref.current.position.set(s.x, s.y, s.z);
        ref.current.rotation.y = s.visualYaw;
      }
      s.state = mag > 0.05 ? 'run' : 'idle';

      // camera follow (same as normal)
      rateClampAngles(s, input.yaw, input.pitch, cdt);
      const dirX = Math.sin(s.camYaw) * Math.cos(s.camPitch);
      const dirY = -Math.sin(s.camPitch);
      const dirZ = Math.cos(s.camYaw) * Math.cos(s.camPitch);
      const tx = s.x, ty = s.y + 1, tz = s.z;
      const flyDist = input.cameraDist;
      _camTarget.set(tx + dirX * flyDist, ty + dirY * flyDist, tz + dirZ * flyDist);
      camera.position.lerp(_camTarget, 1 - Math.pow(CAMERA_LERP_TAU, cdt));
      camera.lookAt(s.x, s.y + 0.9, s.z);

      // send to server
      const nowPerf = performance.now();
      if (nowPerf - lastSendRef.current > 1000 / SEND_HZ) {
        lastSendRef.current = nowPerf;
        onInput({ x: s.x, y: s.y, z: s.z, yaw: s.visualYaw, state: s.state });
      }
      return;
    }

    // ── direction from input + camera yaw ──
    const yaw = input.yaw;
    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const moveX = rightX * input.right + fwdX * input.forward;
    const moveZ = rightZ * input.right + fwdZ * input.forward;
    const mag = Math.hypot(moveX, moveZ);
    let desiredVx = 0;
    let desiredVz = 0;
    if (mag > 0) {
      desiredVx = (moveX / mag) * MOVE_SPEED;
      desiredVz = (moveZ / mag) * MOVE_SPEED;
    }
    if (s.grounded) {
      s.vx = desiredVx;
      s.vz = desiredVz;
    } else {
      // Air control: ease toward desired horizontal velocity
      const k = AIR_CONTROL;
      s.vx = s.vx * (1 - k * cdt * 6) + desiredVx * (k * cdt * 6);
      s.vz = s.vz * (1 - k * cdt * 6) + desiredVz * (k * cdt * 6);
    }

    // ── ladder check (true gravity-suppressed climbing volume) ──
    const inLadderVolume = onLadderVolume(s.x, s.y, s.z, ladders);
    const ladderActive = inLadderVolume && now - s.lastJumpAt > LADDER_RELEASE_MS;

    // ── jump press handling (with buffer + coyote + double jump) ──
    if (consumeJump()) {
      s.bufferedJumpUntil = now + BUFFER_MS;
    }
    const canCoyote = s.grounded || now - s.lastGroundedAt < COYOTE_MS;
    if (now < s.bufferedJumpUntil) {
      if (ladderActive) {
        // Jump off the ladder: pop upward, suspend ladder for LADDER_RELEASE_MS
        s.vy = JUMP_SPEED;
        s.jumpsUsed = 1;
        s.grounded = false;
        s.lastJumpAt = now;
        s.bufferedJumpUntil = -Infinity;
        onJumpsChange?.(s.jumpsUsed);
      } else if (canCoyote && s.jumpsUsed === 0) {
        s.vy = JUMP_SPEED;
        s.jumpsUsed = 1;
        s.grounded = false;
        s.lastJumpAt = now;
        s.bufferedJumpUntil = -Infinity;
        onJumpsChange?.(s.jumpsUsed);
      } else if (cheats.infiniteJumps || s.jumpsUsed < MAX_JUMPS) {
        s.vy = Math.max(s.vy, DOUBLE_JUMP_SPEED);
        s.jumpsUsed += 1;
        s.grounded = false;
        s.lastJumpAt = now;
        s.bufferedJumpUntil = -Infinity;
        onDoubleJump?.();
        onJumpsChange?.(s.jumpsUsed);
      }
    }

    // ── variable jump height (release while rising → cut vy) ──
    const wasHeld = s.wasJumpHeld;
    if (wasHeld && !input.jumpHeld && s.vy > 0 && !ladderActive) {
      s.vy *= VAR_JUMP_CUT;
    }
    s.wasJumpHeld = input.jumpHeld;

    // ── ladder override (post-jump check) ──
    // Re-evaluate, since jump-while-on-ladder set lastJumpAt and disabled ladder.
    const ladderActiveNow = inLadderVolume && now - s.lastJumpAt > LADDER_RELEASE_MS;
    if (ladderActiveNow) {
      s.vx = 0;
      s.vz = 0;
      s.vy = input.forward * CLIMB_SPEED;
      // While on a ladder you have your jumps back (you can hop to a side platform)
      if (s.jumpsUsed !== 0) {
        s.jumpsUsed = 0;
        onJumpsChange?.(0);
      }
    }

    // ── update moving platforms + recycle breakaways BEFORE physics ──
    for (const m of movers) tickMover(m);
    tickBreakaways(breakaways, now);
    const activeBreaks = breakaways.filter((b) => breakawaySolid(b, now));

    // ── carry the player if they were standing on a mover last frame ──
    if (s.mountedMoverIdx >= 0 && s.mountedMoverIdx < movers.length) {
      const m = movers[s.mountedMoverIdx];
      s.x += m.x - m.prevX;
      // Snap Y exactly to the mover top. Accumulating (m.y - m.prevY) drifts
      // by ~1 ULP from the true new top; even that tiny gap is enough to
      // make the horizontal-sweep overlap check (strict `feetY < topY`)
      // fire and shove the player ~1.9m off the platform.
      s.y = m.y + m.hy;
      s.z += m.z - m.prevZ;
    }

    // Compose a combined box list: static + movers + currently-solid breakaways.
    const combinedBoxes: Box[] = [...boxes, ...movers, ...activeBreaks];

    // ── physics ──
    const result = stepPlayer({
      feetX: s.x, feetY: s.y, feetZ: s.z,
      vx: s.vx, vy: s.vy, vz: s.vz,
      dt: cdt,
      gravity: ladderActiveNow ? 0 : GRAVITY,
      boxes: combinedBoxes,
      // While climbing a ladder, ignore every other box's collision. We only
      // move vertically (vx=vz=0) so this can't drive us through anything
      // unintended, and it prevents the destination platform from horizontally
      // shoving us off the top of the ladder during the climb-through phase.
      skipBoxCollisions: ladderActiveNow,
    });
    const wasGrounded = s.grounded;
    s.x = result.feetX; s.y = result.feetY; s.z = result.feetZ;
    s.vx = result.vx;   s.vy = result.vy;   s.vz = result.vz;
    s.grounded = result.grounded;

    if (s.grounded) {
      s.lastGroundedAt = now;
      if (!wasGrounded) {
        s.jumpsUsed = 0;
        onJumpsChange?.(0);
      }
      // Track which mover (if any) we're standing on — for next frame's carry.
      s.mountedMoverIdx = moverUnderfoot(s.x, s.y, s.z, movers);
      // Standing on an idle ice platform starts it cracking (then it falls away).
      for (const b of breakaways) {
        if (b.triggeredAt >= 0) continue;
        const topY = b.y + b.hy;
        if (s.y > topY - 0.14 && s.y < topY + 0.06 && Math.abs(s.x - b.x) < b.hx + PLAYER.rxz && Math.abs(s.z - b.z) < b.hz + PLAYER.rxz) {
          b.triggeredAt = now;
        }
      }
    } else {
      s.mountedMoverIdx = -1;
    }

    // ── checkpoints: arm the highest reached respawn anchor (no downgrade) ──
    // Circular zone, and a tight vertical band so you must actually be standing
    // on the checkpoint deck (not a nearby surface at a different height).
    // Stops once the summit's been reached — see the respawn note below.
    if (s.grounded && !summitDoneRef.current) {
      for (const c of checkpoints) {
        if (c.y <= reachedCpRef.current) continue;
        const dxz = Math.hypot(s.x - c.x, s.z - c.z);
        if (dxz < c.radius && Math.abs(s.y - c.y) < 0.9) {
          reachedCpRef.current = c.y;
          respawnRef.current = { x: c.x, y: c.y + 0.25, z: c.z };
          onCheckpoint?.(c.name, c.zone);
        }
      }
    }

    // ── summit reached → win + unlock flight (once) ──
    if (!summitDoneRef.current) {
      const dx = s.x - goal.x, dy = (s.y + PLAYER.cy) - goal.y, dz = s.z - goal.z;
      if (dx * dx + dy * dy + dz * dz < 2.7 * 2.7) {
        summitDoneRef.current = true;
        onReachSummit?.();
      }
    }

    // Respawn to the last checkpoint. The key case: with a central tower over a
    // solid ground plate you rarely fall below y=-20 — you just thud onto the
    // village floor. So also respawn the moment you drop well below the armed
    // checkpoint (a clear fall), which is what makes checkpoints actually work.
    //
    // Once you've reached the summit, checkpoints switch off entirely: you've
    // won and earned flight (F), so a fall is no longer a setback — land on the
    // floor and fly back up rather than getting teleported to a checkpoint.
    const cpY = reachedCpRef.current;
    const fellOffWorld = s.y < -20;
    const fellBelowCheckpoint = cpY > -Infinity && s.y < cpY - 6;
    if (!summitDoneRef.current && (fellOffWorld || fellBelowCheckpoint)) {
      const sp = respawnRef.current;
      s.x = sp.x; s.y = sp.y; s.z = sp.z;
      s.vx = 0; s.vy = 0; s.vz = 0;
      s.jumpsUsed = 0;
    }

    // Visual yaw toward movement
    if (mag > 0.1) {
      const target = Math.atan2(moveX, moveZ);
      const diff = wrapPi(target - s.visualYaw);
      s.visualYaw += diff * Math.min(1, cdt * 12);
    }

    if (ref.current) {
      ref.current.position.set(s.x, s.y, s.z);
      ref.current.rotation.y = s.visualYaw;
    }
    s.state = !s.grounded ? 'air' : mag > 0.05 ? 'run' : 'idle';

    // ── third-person follow camera with occlusion raycast ──
    // Rate-clamp camera yaw/pitch toward input. Below the threshold the camera
    // tracks the mouse 1:1 (no lag). Above it, the camera arcs around the
    // orbit ring at the clamped angular speed — never chord-cutting through
    // the player on a fast flick.
    rateClampAngles(s, input.yaw, input.pitch, cdt);
    const dirX = Math.sin(s.camYaw) * Math.cos(s.camPitch);
    const dirY = -Math.sin(s.camPitch);
    const dirZ = Math.cos(s.camYaw) * Math.cos(s.camPitch);
    const tx = s.x;
    const ty = s.y + 1;
    const tz = s.z;
    // Raycast from camera target outward to ideal cam pos; pull camera in on hit.
    const desiredDist = input.cameraDist;
    // Occlude against movers too, so the camera doesn't phase inside the lift /
    // shuttle / ramp / timing-wall during the most dramatic sections.
    const hit = rayHitDistance(tx, ty, tz, dirX, dirY, dirZ, desiredDist, combinedBoxes);
    const actualDist = Math.max(CAMERA_MIN_DIST, Math.min(desiredDist, hit - CAMERA_PAD));
    _camTarget.set(tx + dirX * actualDist, ty + dirY * actualDist, tz + dirZ * actualDist);
    camera.position.lerp(_camTarget, 1 - Math.pow(CAMERA_LERP_TAU, cdt));
    camera.lookAt(s.x, s.y + 0.9, s.z);

    // ── send to server at fixed rate ──
    const nowPerf = performance.now();
    if (nowPerf - lastSendRef.current > 1000 / SEND_HZ) {
      lastSendRef.current = nowPerf;
      onInput({ x: s.x, y: s.y, z: s.z, yaw: s.visualYaw, state: s.state });
    }
  });

  return (
    <group ref={ref}>
      <Character variant={variant} state={stateRef.current.state} />
    </group>
  );
}

function wrapPi(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Ease the camera's stored yaw/pitch toward the target yaw/pitch at up to
 *  CAMERA_MAX_ANG_SPEED rad/sec. Below that, the camera tracks the mouse
 *  exactly (no smoothing). Above it, the camera lags behind smoothly so the
 *  follow position stays on the orbit ring instead of chord-cutting across it. */
function rateClampAngles(
  s: { camYaw: number; camPitch: number },
  targetYaw: number, targetPitch: number, dt: number,
): void {
  if (isNaN(s.camYaw)) {
    s.camYaw = targetYaw;
    s.camPitch = targetPitch;
    return;
  }
  const maxStep = CAMERA_MAX_ANG_SPEED * dt;
  // Yaw is unbounded — use shortest-path delta so we don't unwind multiple turns.
  const yawErr = wrapPi(targetYaw - s.camYaw);
  if (Math.abs(yawErr) > maxStep) {
    s.camYaw += Math.sign(yawErr) * maxStep;
  } else {
    s.camYaw = targetYaw;
  }
  // Pitch is already clamped at the input layer — direct delta is fine.
  const pitchErr = targetPitch - s.camPitch;
  if (Math.abs(pitchErr) > maxStep) {
    s.camPitch += Math.sign(pitchErr) * maxStep;
  } else {
    s.camPitch = targetPitch;
  }
}
