import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { generateWorld, type WorldData, type MeshDesc, type Windmill, type Flag, type SmokePuff, type Mover } from './worldgen';

export { generateWorld };
export type { WorldData };

function Mesh({ m }: { m: MeshDesc }) {
  const material = (
    <meshStandardMaterial
      color={(m as { color: string }).color}
      roughness={'roughness' in m ? (m.roughness ?? 0.85) : 0.85}
      metalness={0.04}
      emissive={'emissive' in m && m.emissive ? m.emissive : '#000000'}
      emissiveIntensity={'emissive' in m && m.emissive ? (m.emissiveIntensity ?? 0) : 0}
    />
  );
  const cast = 'cast' in m ? (m.cast ?? true) : true;
  switch (m.type) {
    case 'box':
      return (
        <mesh position={[m.x, m.y, m.z]} rotation={[0, m.rotY ?? 0, 0]} castShadow={cast} receiveShadow={m.receive ?? true}>
          <boxGeometry args={[m.hx * 2, m.hy * 2, m.hz * 2]} />
          {material}
        </mesh>
      );
    case 'cone':
      return (
        <mesh position={[m.x, m.y, m.z]} rotation={[0, m.rotY ?? 0, 0]} castShadow={cast}>
          <coneGeometry args={[m.radius, m.height, m.segments ?? 16]} />
          {material}
        </mesh>
      );
    case 'cylinder':
      return (
        <mesh position={[m.x, m.y, m.z]} rotation={[0, m.rotY ?? 0, 0]} castShadow={cast}>
          <cylinderGeometry args={[m.radius, m.radius, m.height, m.segments ?? 16]} />
          {material}
        </mesh>
      );
    case 'sphere':
      return (
        <mesh position={[m.x, m.y, m.z]} castShadow={cast}>
          <sphereGeometry args={[m.radius, m.segments ?? 18, m.segments ?? 14]} />
          {material}
        </mesh>
      );
  }
}

function WindmillNode({ wm }: { wm: Windmill }) {
  const hubRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (hubRef.current) hubRef.current.rotation.z += dt * 0.6;
  });
  return (
    <group position={[wm.x, wm.y, wm.z]} rotation={[0, wm.rotY, 0]}>
      {/* hub */}
      <mesh castShadow>
        <sphereGeometry args={[0.25, 14, 14]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* blades */}
      <group ref={hubRef}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
            <mesh position={[0, 1.2, 0.06]} castShadow>
              <boxGeometry args={[0.28, 2.4, 0.08]} />
              <meshStandardMaterial color="#fef3c7" />
            </mesh>
            <mesh position={[0.05, 1.8, 0.07]} castShadow>
              <boxGeometry args={[0.5, 0.9, 0.02]} />
              <meshStandardMaterial color="#fde68a" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function FlagNode({ f }: { f: Flag }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = Math.sin(t * 3 + f.x + f.z) * 0.18;
    ref.current.scale.x = 1 + Math.sin(t * 5 + f.z) * 0.06;
  });
  return (
    <group position={[f.x, f.y, f.z]} rotation={[0, f.rotY, 0]}>
      <mesh ref={ref} position={[0.4, 0, 0]}>
        <boxGeometry args={[0.85, 0.55, 0.02]} />
        <meshStandardMaterial color={f.color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Smoke({ p }: { p: SmokePuff }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < ref.current.children.length; i++) {
      const child = ref.current.children[i] as THREE.Mesh;
      const phase = (t + i * 0.7) % 3.0;
      child.position.y = phase * 0.8;
      child.position.x = Math.sin(phase * 1.6 + i) * 0.25;
      const scale = 0.4 + phase * 0.25;
      child.scale.setScalar(scale);
      const mat = child.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, 1 - phase / 3);
    }
  });
  return (
    <group ref={ref} position={[p.x, p.y, p.z]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.25, 10, 10]} />
          <meshStandardMaterial color="#cbd5e1" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function GoalOrb({ x, y, z }: { x: number; y: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = y + Math.sin(t * 1.4) * 0.25;
    ref.current.rotation.y = t * 0.5;
  });
  return (
    <group ref={ref} position={[x, y, z]}>
      <mesh>
        <sphereGeometry args={[0.7, 24, 24]} />
        <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={2.5} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={0.4} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <pointLight color="#fde047" intensity={2} distance={12} />
    </group>
  );
}

/** Render a ladder volume's "front" indicator (a soft glow strip).
 *  The volume is already in the mesh list as a deco strip; we just render the
 *  wooden frame here for visual clarity. */
function LadderHint({ box }: { box: { x: number; y: number; z: number; hx: number; hy: number; hz: number } }) {
  // Faint glow box matching the climb volume
  return (
    <mesh position={[box.x, box.y, box.z]}>
      <boxGeometry args={[box.hx * 0.7, box.hy * 2, box.hz * 0.7]} />
      <meshStandardMaterial color="#1a1a1a" emissive="#fbbf24" emissiveIntensity={0.08} transparent opacity={0.15} depthWrite={false} />
    </mesh>
  );
}

/** Moving platform — time-synced via wall clock so every client sees the same
 *  position. The Player physics reads the same Date.now() and processes pushes
 *  client-side, so visuals and collisions stay aligned. */
function MoverNode({ mover }: { mover: Mover }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = Date.now() / 1000;
    const phase = ((t / mover.period + mover.phase) % 1 + 1) % 1;
    const s = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    ref.current.position.x = mover.ax + (mover.bx - mover.ax) * s;
    ref.current.position.y = mover.ay + (mover.by - mover.ay) * s;
    ref.current.position.z = mover.az + (mover.bz - mover.az) * s;
  });
  const isWall = mover.kind === 'wall';
  return (
    <group ref={ref} position={[mover.x, mover.y, mover.z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[mover.hx * 2, mover.hy * 2, mover.hz * 2]} />
        <meshStandardMaterial
          color={mover.color}
          roughness={isWall ? 0.4 : 0.7}
          emissive={isWall ? '#dc2626' : '#000000'}
          emissiveIntensity={isWall ? 0.25 : 0}
        />
      </mesh>
      {isWall ? (
        <>
          {/* Hazard stripes on both wide faces */}
          {[-1, 1].map((side) => (
            <group key={side}>
              {Array.from({ length: 5 }).map((_, i) => {
                const w = (mover.hx * 2) / 5;
                const x = -mover.hx + w * (i + 0.5);
                const col = i % 2 === 0 ? '#fde047' : '#0f172a';
                return (
                  <mesh key={i} position={[x, 0, side * (mover.hz + 0.01)]}>
                    <boxGeometry args={[w * 0.9, mover.hy * 1.8, 0.02]} />
                    <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.15} />
                  </mesh>
                );
              })}
            </group>
          ))}
          {/* Pulsing red top edge so it's clearly threatening */}
          <mesh position={[0, mover.hy + 0.05, 0]}>
            <boxGeometry args={[mover.hx * 2 + 0.05, 0.1, mover.hz * 2 + 0.05]} />
            <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={1.0} />
          </mesh>
        </>
      ) : (
        /* Yellow glowing edge for ridable platforms */
        <mesh position={[0, mover.hy + 0.04, 0]}>
          <boxGeometry args={[mover.hx * 2 + 0.05, 0.08, mover.hz * 2 + 0.05]} />
          <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
}

export default function World({ data }: { data: WorldData }) {
  const meshNodes = useMemo(() => data.meshes.map((m, i) => <Mesh key={i} m={m} />), [data]);
  return (
    <>
      {meshNodes}
      {data.ladders.map((box, i) => <LadderHint key={`l-${i}`} box={box} />)}
      {data.movers.map((mover, i) => <MoverNode key={`mv-${i}`} mover={mover} />)}
      {data.windmills.map((wm, i) => <WindmillNode key={`wm-${i}`} wm={wm} />)}
      {data.flags.map((f, i) => <FlagNode key={`fl-${i}`} f={f} />)}
      {data.smoke.map((s, i) => <Smoke key={`sm-${i}`} p={s} />)}
      <GoalOrb x={data.goal.x} y={data.goal.y} z={data.goal.z} />
    </>
  );
}
