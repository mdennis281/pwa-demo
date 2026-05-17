import { useMemo } from 'react';
import type { Box } from './physics';

export type WorldData = {
  boxes: Box[];
  maxHeight: number;
};

/** Tiny seeded RNG so the world is the same for everyone in a session. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function generateWorld(seed = 1337): WorldData {
  const rng = makeRng(seed);
  const boxes: Box[] = [];

  // Ground plate
  boxes.push({ x: 0, y: -0.5, z: 0, hx: 25, hy: 0.5, hz: 25 });

  // Tower of platforms
  let y = 1.8;
  const tiers = 60;
  for (let i = 0; i < tiers; i++) {
    // funnel: range tightens slightly as we go up to keep the player on track
    const range = 18 - (i / tiers) * 8;
    const hx = 1.5 + rng() * 2.5;
    const hz = 1.5 + rng() * 2.5;
    const x = (rng() * 2 - 1) * range;
    const z = (rng() * 2 - 1) * range;
    boxes.push({ x, y, z, hx, hy: 0.4, hz });
    y += 1.5 + rng() * 1.3;
  }

  return { boxes, maxHeight: y };
}

function tierColor(y: number, max: number): string {
  const t = Math.max(0, Math.min(1, y / max));
  const hue = 200 - t * 280; // cyan -> magenta as we climb
  return `hsl(${hue}, 75%, ${55 - t * 10}%)`;
}

export default function World({ data }: { data: WorldData }) {
  const meshes = useMemo(() => {
    return data.boxes.map((b, i) => {
      const isGround = i === 0;
      const color = isGround ? '#1e293b' : tierColor(b.y, data.maxHeight);
      return (
        <mesh key={i} position={[b.x, b.y, b.z]} receiveShadow castShadow={!isGround}>
          <boxGeometry args={[b.hx * 2, b.hy * 2, b.hz * 2]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} />
        </mesh>
      );
    });
  }, [data]);

  return (
    <>
      {meshes}
      {/* Decorative: a glowing top marker so people see the goal */}
      <mesh position={[0, data.maxHeight + 2, 0]}>
        <sphereGeometry args={[0.6, 24, 24]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={2} />
      </mesh>
    </>
  );
}
