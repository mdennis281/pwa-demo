import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Character from './Character';
import { input, consumeJump } from './controls/input';
import { stepPlayer } from './physics';
import type { Box } from './physics';
import type { LocalInput } from '@pwa-demo/shared';

const MOVE_SPEED = 6.5;
const JUMP_SPEED = 8.5;
const GRAVITY = 24;
const CAMERA_DIST = 6;
const SEND_HZ = 20;

export default function Player({
  variant,
  boxes,
  onInput,
}: {
  variant: number;
  boxes: Box[];
  onInput: (i: LocalInput) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const stateRef = useRef({
    x: 0, y: 2, z: 0,
    vx: 0, vy: 0, vz: 0,
    grounded: false,
    visualYaw: 0,
    state: 'idle' as 'idle' | 'run' | 'air',
  });
  const lastSendRef = useRef(0);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 1, 0);
  }, [camera]);

  useFrame((_, dt) => {
    const s = stateRef.current;
    const cdt = Math.min(dt, 0.05); // clamp dt to avoid tunneling on hitches

    // Camera-relative movement vector
    const yaw = input.yaw;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const moveX = right.x * input.right + fwd.x * input.forward;
    const moveZ = right.z * input.right + fwd.z * input.forward;
    const mag = Math.hypot(moveX, moveZ);
    const speed = MOVE_SPEED;
    if (mag > 0) {
      s.vx = (moveX / mag) * speed;
      s.vz = (moveZ / mag) * speed;
    } else {
      s.vx = 0;
      s.vz = 0;
    }

    // Step physics
    const result = stepPlayer({
      feetX: s.x, feetY: s.y, feetZ: s.z,
      vx: s.vx, vy: s.vy, vz: s.vz,
      jumpRequested: consumeJump(),
      grounded: s.grounded,
      dt: cdt,
      gravity: GRAVITY,
      jumpSpeed: JUMP_SPEED,
      boxes,
    });
    s.x = result.feetX; s.y = result.feetY; s.z = result.feetZ;
    s.vx = result.vx;   s.vy = result.vy;   s.vz = result.vz;
    s.grounded = result.grounded;

    // Auto-respawn if we fall off
    if (s.y < -20) {
      s.x = 0; s.y = 2; s.z = 0;
      s.vx = 0; s.vy = 0; s.vz = 0;
    }

    // Visual yaw turns toward movement direction
    if (mag > 0.1) {
      const target = Math.atan2(moveX, moveZ);
      const diff = wrapPi(target - s.visualYaw);
      s.visualYaw += diff * Math.min(1, cdt * 12);
    }

    // Update mesh transform
    if (ref.current) {
      ref.current.position.set(s.x, s.y, s.z);
      ref.current.rotation.y = s.visualYaw;
    }

    // Update animation state
    s.state = !s.grounded ? 'air' : mag > 0.05 ? 'run' : 'idle';

    // Third-person follow camera
    const pitch = input.pitch;
    const camOff = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      -Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    ).multiplyScalar(CAMERA_DIST);
    const targetPos = new THREE.Vector3(s.x, s.y + 1, s.z);
    const ideal = targetPos.clone().add(camOff);
    camera.position.lerp(ideal, 1 - Math.pow(0.001, cdt));
    camera.lookAt(s.x, s.y + 0.9, s.z);

    // Send input at fixed rate
    const now = performance.now();
    if (now - lastSendRef.current > 1000 / SEND_HZ) {
      lastSendRef.current = now;
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
