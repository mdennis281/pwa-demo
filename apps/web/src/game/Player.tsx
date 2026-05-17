import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Character from './Character';
import { input, consumeJump } from './controls/input';
import { PLAYER, rayHitDistance, stepPlayer } from './physics';
import type { Box } from './physics';
import type { Mover } from './worldgen';
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

const CAMERA_DIST = 6.5;
const CAMERA_LERP_TAU = 0.07;
const CAMERA_MIN_DIST = 1.2;
const CAMERA_PAD = 0.4;
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
  const phase = ((t / m.period + m.phase) % 1 + 1) % 1; // 0..1
  const s = (1 - Math.cos(phase * Math.PI * 2)) / 2;    // 0..1..0 (sine ease)
  m.x = m.ax + (m.bx - m.ax) * s;
  m.y = m.ay + (m.by - m.ay) * s;
  m.z = m.az + (m.bz - m.az) * s;
}

/** Find which mover the player is standing on, if any. Returns -1 if none. */
function moverUnderfoot(x: number, y: number, z: number, movers: Mover[]): number {
  for (let i = 0; i < movers.length; i++) {
    const m = movers[i];
    const topY = m.y + m.hy;
    if (Math.abs(y - topY) < 0.06 &&
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
  spawn,
  onInput,
  onDoubleJump,
  onJumpsChange,
}: {
  variant: number;
  boxes: Box[];
  ladders: Box[];
  movers: Mover[];
  spawn: { x: number; y: number; z: number };
  onInput: (i: LocalInput) => void;
  onDoubleJump?: () => void;
  onJumpsChange?: (used: number) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const spawnRef = useRef(spawn);
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
  });
  const lastSendRef = useRef(0);
  const { camera } = useThree();

  useEffect(() => {
    spawnRef.current = spawn;
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
    const cdt = Math.min(dt, 0.05);
    const now = state.clock.elapsedTime * 1000;

    // ── direction from input + camera yaw ──
    const yaw = input.yaw;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const moveX = right.x * input.right + fwd.x * input.forward;
    const moveZ = right.z * input.right + fwd.z * input.forward;
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
      } else if (s.jumpsUsed < MAX_JUMPS) {
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

    // ── update moving platform positions BEFORE physics so collisions see them ──
    for (const m of movers) tickMover(m);

    // ── carry the player if they were standing on a mover last frame ──
    if (s.mountedMoverIdx >= 0 && s.mountedMoverIdx < movers.length) {
      const m = movers[s.mountedMoverIdx];
      s.x += m.x - m.prevX;
      s.y += m.y - m.prevY;
      s.z += m.z - m.prevZ;
    }

    // Compose a combined box list (movers as Boxes at their current positions)
    const combinedBoxes = movers.length > 0
      ? [...boxes, ...movers as unknown as Box[]]
      : boxes;

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
    } else {
      s.mountedMoverIdx = -1;
    }

    // Respawn if we fall off
    if (s.y < -20) {
      const sp = spawnRef.current;
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
    const pitch = input.pitch;
    const dirX = Math.sin(yaw) * Math.cos(pitch);
    const dirY = -Math.sin(pitch);
    const dirZ = Math.cos(yaw) * Math.cos(pitch);
    const tx = s.x;
    const ty = s.y + 1;
    const tz = s.z;
    // Raycast from camera target outward to ideal cam pos; pull camera in on hit.
    const hit = rayHitDistance(tx, ty, tz, dirX, dirY, dirZ, CAMERA_DIST, boxes);
    const actualDist = Math.max(CAMERA_MIN_DIST, Math.min(CAMERA_DIST, hit - CAMERA_PAD));
    const idealX = tx + dirX * actualDist;
    const idealY = ty + dirY * actualDist;
    const idealZ = tz + dirZ * actualDist;
    _camTarget.set(idealX, idealY, idealZ);
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
