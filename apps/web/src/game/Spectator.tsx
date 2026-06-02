import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { input } from './controls/input';

const SPECT_SPEED = 18;

export default function Spectator({ paused = false }: { paused?: boolean }) {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(15, 12, 15));

  useEffect(() => {
    camera.position.copy(pos.current);
    camera.lookAt(0, 8, 0);
  }, [camera]);

  useFrame((_, dt) => {
    if (paused) return; // frozen free-cam while the game is paused
    const yaw = input.yaw;
    const pitch = input.pitch;
    const cdt = Math.min(dt, 0.05);

    // Movement mirrors fly mode (see Player.tsx): WASD strafes in the ground
    // plane relative to camera yaw, Space ascends and Shift descends — the look
    // pitch only aims the camera, it does not tilt the movement direction.
    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    let moveX = rightX * input.right + fwdX * input.forward;
    let moveZ = rightZ * input.right + fwdZ * input.forward;
    const mag = Math.hypot(moveX, moveZ);
    if (mag > 0) { moveX /= mag; moveZ /= mag; } // normalize so diagonals aren't faster
    const moveY = (input.jumpHeld ? 1 : 0) - (input.descendHeld ? 1 : 0);

    pos.current.x += moveX * SPECT_SPEED * cdt;
    pos.current.y += moveY * SPECT_SPEED * cdt;
    pos.current.z += moveZ * SPECT_SPEED * cdt;
    camera.position.copy(pos.current);

    // Look in the direction of camera yaw/pitch (free look).
    const look = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ).multiplyScalar(5).add(pos.current);
    camera.lookAt(look);
  });

  return null;
}
