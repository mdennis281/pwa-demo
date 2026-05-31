import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Character from './Character';
import { Text } from '@react-three/drei';

const INTERP_MS = 110;

type Sample = { t: number; x: number; y: number; z: number; yaw: number; state: 'idle' | 'run' | 'air' };

export default function RemotePlayer({
  variant,
  displayName,
  isHost,
  latestX,
  latestY,
  latestZ,
  latestYaw,
  latestState,
  serverTime,
}: {
  variant: number;
  displayName: string;
  isHost: boolean;
  latestX: number;
  latestY: number;
  latestZ: number;
  latestYaw: number;
  latestState: 'idle' | 'run' | 'air';
  serverTime: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const buf = useRef<Sample[]>([]);
  // Name-label visibility: only render the (troika SDF) label for nearby players.
  const nearRef = useRef(false);
  const [near, setNear] = useState(false);

  useEffect(() => {
    buf.current.push({
      t: serverTime,
      x: latestX, y: latestY, z: latestZ, yaw: latestYaw, state: latestState,
    });
    // keep the last ~500ms of samples
    const cutoff = serverTime - 600;
    while (buf.current.length > 2 && buf.current[0].t < cutoff) buf.current.shift();
  }, [serverTime, latestX, latestY, latestZ, latestYaw, latestState]);

  useFrame((state) => {
    if (!ref.current || buf.current.length === 0) return;
    const renderTime = performance.now() + buf.current[buf.current.length - 1].t - performance.now() - INTERP_MS;
    // Find two samples that bracket renderTime
    let a: Sample | null = null;
    let b: Sample | null = null;
    for (let i = 0; i < buf.current.length - 1; i++) {
      if (buf.current[i].t <= renderTime && buf.current[i + 1].t >= renderTime) {
        a = buf.current[i];
        b = buf.current[i + 1];
        break;
      }
    }
    let x = latestX, y = latestY, z = latestZ, yaw = latestYaw;
    if (a && b) {
      const range = b.t - a.t || 1;
      const t = Math.max(0, Math.min(1, (renderTime - a.t) / range));
      x = lerp(a.x, b.x, t);
      y = lerp(a.y, b.y, t);
      z = lerp(a.z, b.z, t);
      yaw = lerpAngle(a.yaw, b.yaw, t);
    } else {
      const last = buf.current[buf.current.length - 1];
      x = last.x; y = last.y; z = last.z; yaw = last.yaw;
    }
    ref.current.position.set(x, y, z);
    ref.current.rotation.y = yaw;
    // Only build/draw the name label for nearby players (hysteresis 10m→12m) so
    // distant avatars (and the whole bot fleet) skip the troika Text cost.
    const dsq = state.camera.position.distanceToSquared(ref.current.position);
    const want = nearRef.current ? dsq < 144 : dsq < 100;
    if (want !== nearRef.current) { nearRef.current = want; setNear(want); }
  });

  return (
    <group ref={ref}>
      <Character variant={variant} state={latestState} />
      {near && (
        <Text
          position={[0, 2.05, 0]}
          fontSize={0.22}
          color="#f8fafc"
          outlineColor="#0f172a"
          outlineWidth={0.02}
          anchorX="center"
          anchorY="middle"
        >
          {isHost ? `★ ${displayName}` : displayName}
        </Text>
      )}
    </group>
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
