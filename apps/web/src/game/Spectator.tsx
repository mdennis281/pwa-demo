import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { input } from './controls/input';

const SPECT_SPEED = 18;

export default function Spectator() {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(15, 12, 15));

  useEffect(() => {
    camera.position.copy(pos.current);
    camera.lookAt(0, 8, 0);
  }, [camera]);

  useFrame((_, dt) => {
    const yaw = input.yaw;
    const pitch = input.pitch;
    const cdt = Math.min(dt, 0.05);

    const fwd = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    pos.current.addScaledVector(fwd, input.forward * SPECT_SPEED * cdt);
    pos.current.addScaledVector(right, input.right * SPECT_SPEED * cdt);
    camera.position.copy(pos.current);

    // Look in the direction of camera yaw/pitch
    const look = pos.current.clone().add(fwd.clone().multiplyScalar(5));
    camera.lookAt(look);
  });

  return null;
}
