import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Character from './Character';
import { input, consumeJump } from './controls/input';
import { rayHitDistance, stepPlayer } from './physics';
import type { Box } from './physics';
import type { LocalInput } from '@pwa-demo/shared';

const MOVE_SPEED = 7.0;
const AIR_CONTROL = 0.55;          // 0..1 multiplier on air-direction authority
const JUMP_SPEED = 13;             // ~3.5m apex
const DOUBLE_JUMP_SPEED = 10;      // adds ~2m at apex if perfectly timed
const GRAVITY = 28;
const VAR_JUMP_CUT = 0.45;         // multiplier when releasing jump early
const COYOTE_MS = 120;
const BUFFER_MS = 110;
const MAX_JUMPS = 2;

const CAMERA_DIST = 6.5;
const CAMERA_LERP_TAU = 0.07;
const CAMERA_MIN_DIST = 1.2;
const CAMERA_PAD = 0.4;
const SEND_HZ = 20;

const _camTarget = new THREE.Vector3();

export default function Player({
  variant,
  boxes,
  spawn,
  onInput,
  onDoubleJump,
  onJumpsChange,
}: {
  variant: number;
  boxes: Box[];
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

    // ── jump press handling (with buffer + coyote + double jump) ──
    if (consumeJump()) {
      s.bufferedJumpUntil = now + BUFFER_MS;
    }
    const canCoyote = s.grounded || now - s.lastGroundedAt < COYOTE_MS;
    if (now < s.bufferedJumpUntil) {
      if (canCoyote && s.jumpsUsed === 0) {
        s.vy = JUMP_SPEED;
        s.jumpsUsed = 1;
        s.grounded = false;
        s.bufferedJumpUntil = -Infinity;
        onJumpsChange?.(s.jumpsUsed);
      } else if (s.jumpsUsed < MAX_JUMPS) {
        // double jump: SET if it would be a gain, else still reset upward
        s.vy = Math.max(s.vy, DOUBLE_JUMP_SPEED);
        s.jumpsUsed += 1;
        s.grounded = false;
        s.bufferedJumpUntil = -Infinity;
        onDoubleJump?.();
        onJumpsChange?.(s.jumpsUsed);
      }
    }

    // ── variable jump height (release while rising → cut vy) ──
    const wasHeld = s.wasJumpHeld;
    if (wasHeld && !input.jumpHeld && s.vy > 0) {
      s.vy *= VAR_JUMP_CUT;
    }
    s.wasJumpHeld = input.jumpHeld;

    // ── physics ──
    const result = stepPlayer({
      feetX: s.x, feetY: s.y, feetZ: s.z,
      vx: s.vx, vy: s.vy, vz: s.vz,
      dt: cdt,
      gravity: GRAVITY,
      boxes,
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
