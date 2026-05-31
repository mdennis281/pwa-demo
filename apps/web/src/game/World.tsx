import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { generateWorld, BREAK_DELAY_MS, BREAK_RESPAWN_MS, type WorldData, type MeshDesc, type Windmill, type Flag, type SmokePuff, type Mover, type Waterfall, type WaterWheel, type Breakaway } from './worldgen';

export { generateWorld };
export type { WorldData };

const _one = new THREE.Vector3(1, 1, 1);
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m4 = new THREE.Matrix4();

// Resolved material properties for a mesh desc (defaults match the old per-mesh material).
type MatProps = { color: string; rough: number; emissive: string; emInt: number; cast: boolean; receive: boolean };
function matProps(m: MeshDesc): MatProps {
  const mm = m as Record<string, unknown>;
  return {
    color: mm.color as string,
    rough: (mm.roughness as number | undefined) ?? 0.85,
    emissive: (mm.emissive as string | undefined) || '#000000',
    emInt: (mm.emissiveIntensity as number | undefined) ?? 0,
    cast: (mm.cast as boolean | undefined) ?? true,
    receive: (mm.receive as boolean | undefined) ?? true,
  };
}
function matKey(p: MatProps): string {
  return `${p.color}|${p.rough}|${p.emissive}|${p.emInt}|${p.cast}|${p.receive}`;
}

/** Build a single geometry for a mesh desc with its world transform baked in. */
function bakedGeometry(m: MeshDesc): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  switch (m.type) {
    case 'box': g = new THREE.BoxGeometry(m.hx * 2, m.hy * 2, m.hz * 2); break;
    case 'cone': g = new THREE.ConeGeometry(m.radius, m.height, m.segments ?? 16); break;
    case 'cylinder': g = new THREE.CylinderGeometry(m.radius, m.radius, m.height, m.segments ?? 16); break;
    case 'sphere': g = new THREE.SphereGeometry(m.radius, m.segments ?? 18, m.segments ?? 14); break;
  }
  // Strip extras so every geometry in a merge group has identical attributes.
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  const rotY = ('rotY' in m ? m.rotY : 0) ?? 0;
  _e.set(0, rotY, 0);
  _q.setFromEuler(_e);
  _m4.compose(new THREE.Vector3(m.x, m.y, m.z), _q, _one);
  g.applyMatrix4(_m4);
  return g;
}

/** All static (non-animated) geometry, merged into one draw call per material
 *  signature. Cuts the world from ~1800 draw calls to ~150. Built once. */
function MergedStatic({ meshes }: { meshes: MeshDesc[] }) {
  const groups = useMemo(() => {
    const byKey = new Map<string, { props: MatProps; geos: THREE.BufferGeometry[] }>();
    for (const m of meshes) {
      const props = matProps(m);
      const key = matKey(props);
      let grp = byKey.get(key);
      if (!grp) { grp = { props, geos: [] }; byKey.set(key, grp); }
      grp.geos.push(bakedGeometry(m));
    }
    const out: Array<{ key: string; geometry: THREE.BufferGeometry; props: MatProps }> = [];
    for (const [key, grp] of byKey) {
      const merged = grp.geos.length === 1 ? grp.geos[0] : mergeGeometries(grp.geos, false);
      if (grp.geos.length > 1) for (const gg of grp.geos) gg.dispose();
      if (merged) out.push({ key, geometry: merged, props: grp.props });
    }
    return out;
  }, [meshes]);

  // Three.js doesn't auto-dispose user-created geometry; free it on unmount or
  // when the merged set is rebuilt (leave/rejoin) so the GPU buffers don't leak.
  useEffect(() => () => { for (const g of groups) g.geometry.dispose(); }, [groups]);

  return (
    <>
      {groups.map((g) => (
        <mesh key={g.key} geometry={g.geometry} castShadow={g.props.cast} receiveShadow={g.props.receive}>
          <meshStandardMaterial
            color={g.props.color}
            roughness={g.props.rough}
            metalness={0.04}
            emissive={g.props.emissive}
            emissiveIntensity={g.props.emInt}
          />
        </mesh>
      ))}
    </>
  );
}

function WindmillNode({ wm }: { wm: Windmill }) {
  const hubRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (hubRef.current) hubRef.current.rotation.z += dt * 0.6; });
  return (
    <group position={[wm.x, wm.y, wm.z]} rotation={[0, wm.rotY, 0]} scale={wm.scale ?? 1}>
      <mesh castShadow>
        <sphereGeometry args={[0.25, 14, 14]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
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
      child.scale.setScalar(0.4 + phase * 0.25);
      (child.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - phase / 3);
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

/** The summit beacon — a hovering, spinning crystal that you touch to win and
 *  unlock flight. */
function Beacon({ x, y, z }: { x: number; y: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = y + Math.sin(t * 1.2) * 0.18;
    ref.current.rotation.y = t * 0.45;
  });
  return (
    <group ref={ref} position={[x, y, z]}>
      <mesh>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={2.6} flatShading />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.3, 16, 16]} />
        <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={0.4} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <pointLight color="#fde047" intensity={3} distance={16} />
    </group>
  );
}

/** A stylized cascading waterfall: a soft white-blue column + bright streaks
 *  scrolling downward + foam at the lip and the splash pool. */
function WaterfallNode({ w }: { w: Waterfall }) {
  const streaks = useRef<THREE.Group>(null);
  const splash = useRef<THREE.Group>(null);
  const cw = Math.min(w.w, 1.6); // keep it slender, not a slab
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (streaks.current) for (let i = 0; i < streaks.current.children.length; i++) {
      const c = streaks.current.children[i] as THREE.Mesh;
      const ph = (t * 5 + i * 0.7) % 1;
      c.position.y = w.h * 0.5 - ph * w.h;
      (c.material as THREE.MeshStandardMaterial).opacity = 0.85 * Math.sin(ph * Math.PI);
    }
    if (splash.current) for (let i = 0; i < splash.current.children.length; i++) {
      const c = splash.current.children[i] as THREE.Mesh;
      const ph = (t * 2.2 + i * 0.4) % 1;
      c.scale.setScalar(0.35 + ph * 0.6);
      (c.material as THREE.MeshStandardMaterial).opacity = 0.7 * (1 - ph);
    }
  });
  return (
    <group position={[w.x, w.y, w.z]} rotation={[0, w.rotY, 0]}>
      {/* soft body */}
      <mesh>
        <boxGeometry args={[cw, w.h, 0.35]} />
        <meshStandardMaterial color="#d8f1ff" emissive="#bfe6ff" emissiveIntensity={0.3} transparent opacity={0.5} depthWrite={false} roughness={0.4} />
      </mesh>
      {/* bright scrolling streaks of falling water */}
      <group ref={streaks}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={i} position={[(i / 4 - 0.5) * cw * 0.7, 0, 0.2]}>
            <boxGeometry args={[0.16, 2.4, 0.12]} />
            <meshStandardMaterial color="#ffffff" emissive="#eaf7ff" emissiveIntensity={0.5} transparent opacity={0.8} depthWrite={false} />
          </mesh>
        ))}
      </group>
      {/* foam at the lip */}
      <group position={[0, w.h / 2 - 0.1, 0.18]}>
        {[-1, 0, 1].map((i) => (
          <mesh key={i} position={[i * cw * 0.32, 0, 0]}><sphereGeometry args={[0.36, 8, 8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.9} /></mesh>
        ))}
      </group>
      {/* animated splash pool at the base */}
      <group ref={splash} position={[0, -w.h / 2 + 0.2, 0.25]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[(i - 2) * 0.55, 0, (i % 2) * 0.3]}><sphereGeometry args={[0.5, 8, 8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} /></mesh>
        ))}
      </group>
    </group>
  );
}

/** A turning water-wheel — paddles around a hub, spinning slowly. */
function WaterWheelNode({ wheel }: { wheel: WaterWheel }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * 0.7; });
  const r = wheel.radius, paddles = 8;
  return (
    <group position={[wheel.x, wheel.y, wheel.z]} rotation={[0, wheel.rotY, 0]}>
      <group ref={ref}>
        {Array.from({ length: paddles }).map((_, i) => {
          const a = (i / paddles) * Math.PI * 2;
          return (
            <group key={i} rotation={[0, 0, a]}>
              <mesh position={[r, 0, 0]} castShadow>
                <boxGeometry args={[0.3, 0.5, 0.7]} />
                <meshStandardMaterial color="#a06b34" />
              </mesh>
              <mesh position={[r * 0.5, 0, 0]}>
                <boxGeometry args={[r, 0.08, 0.08]} />
                <meshStandardMaterial color="#522e10" />
              </mesh>
            </group>
          );
        })}
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.8, 8]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
    </group>
  );
}

/** Moving platform — time-synced via wall clock so every client sees the same
 *  position. The Player physics reads the same Date.now() so visuals and
 *  collisions stay aligned. Style is cosmetic only. */
function MoverNode({ mover }: { mover: Mover }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = Date.now() / 1000;
    if (mover.orbit) {
      const ang = (t / mover.period + mover.phase) * Math.PI * 2;
      ref.current.position.set(mover.orbit.px + Math.cos(ang) * mover.orbit.radius, mover.orbit.py + Math.sin(ang) * mover.orbit.radius, mover.orbit.pz);
      return;
    }
    const phase = ((t / mover.period + mover.phase) % 1 + 1) % 1;
    const s = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    ref.current.position.x = mover.ax + (mover.bx - mover.ax) * s;
    ref.current.position.y = mover.ay + (mover.by - mover.ay) * s;
    ref.current.position.z = mover.az + (mover.bz - mover.az) * s;
  });
  const isWall = mover.kind === 'wall';
  const style = mover.style ?? (isWall ? 'wall' : 'shuttle');
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

      {style === 'wall' && (
        <>
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
          <mesh position={[0, mover.hy + 0.05, 0]}>
            <boxGeometry args={[mover.hx * 2 + 0.05, 0.1, mover.hz * 2 + 0.05]} />
            <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={1.0} />
          </mesh>
        </>
      )}

      {style === 'ramp' && (
        <>
          {/* cleats so the deck reads as a moving ramp */}
          {Array.from({ length: 5 }).map((_, i) => {
            const z = -mover.hz + (mover.hz * 2) * ((i + 0.5) / 5);
            return (
              <mesh key={i} position={[0, mover.hy + 0.03, z]}>
                <boxGeometry args={[mover.hx * 1.8, 0.06, 0.12]} />
                <meshStandardMaterial color="#522e10" />
              </mesh>
            );
          })}
          <mesh position={[0, mover.hy + 0.04, 0]}>
            <boxGeometry args={[mover.hx * 2 + 0.05, 0.08, mover.hz * 2 + 0.05]} />
            <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={0.7} />
          </mesh>
        </>
      )}

      {style === 'lift' && (
        <>
          {([[1, 1], [1, -1], [-1, 1], [-1, -1]] as const).map(([sx, sz], i) => (
            <mesh key={i} position={[sx * (mover.hx - 0.1), mover.hy + 0.6, sz * (mover.hz - 0.1)]}>
              <cylinderGeometry args={[0.04, 0.04, 1.2, 6]} />
              <meshStandardMaterial color="#475569" metalness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, mover.hy + 0.04, 0]}>
            <boxGeometry args={[mover.hx * 2 + 0.05, 0.08, mover.hz * 2 + 0.05]} />
            <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={0.8} />
          </mesh>
        </>
      )}

      {(style === 'shuttle' || style === 'cart' || style === 'gondola') && (
        <mesh position={[0, mover.hy + 0.04, 0]}>
          <boxGeometry args={[mover.hx * 2 + 0.05, 0.08, mover.hz * 2 + 0.05]} />
          <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={0.8} />
        </mesh>
      )}
      {style === 'cart' && (
        // little cargo-cart sides + wheels so it reads as a market cart
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * mover.hx, mover.hy + 0.25, 0]}><boxGeometry args={[0.1, 0.5, mover.hz * 1.8]} /><meshStandardMaterial color="#6b4422" /></mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s + 2} position={[s * mover.hx * 0.7, -mover.hy - 0.1, mover.hz]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.25, 0.25, 0.12, 10]} /><meshStandardMaterial color="#1f1308" /></mesh>
          ))}
        </>
      )}
      {style === 'gondola' && (
        <mesh position={[0, mover.hy + 0.4, -mover.hz]}><boxGeometry args={[mover.hx * 2, 0.7, 0.08]} /><meshStandardMaterial color="#7a4b1e" /></mesh>
      )}
    </group>
  );
}

/** The climb volume's affordance: a soft glow column + upward-drifting chevrons
 *  so it's unmistakable you climb here by holding W. */
function LadderHint({ box }: { box: { x: number; y: number; z: number; hx: number; hy: number; hz: number } }) {
  const ref = useRef<THREE.Group>(null);
  // No translucent volume box (it looked nasty). Just a couple of small glowing
  // chevrons drifting up the LOWER part of the ladder as a "climb here" hint.
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < ref.current.children.length; i++) {
      const c = ref.current.children[i] as THREE.Mesh;
      const ph = (t * 1.1 + i / 3) % 1;
      c.position.y = -box.hy + 0.5 + ph * 2.4;
      (c.material as THREE.MeshStandardMaterial).opacity = Math.sin(ph * Math.PI) * 0.85;
    }
  });
  return (
    <group position={[box.x, box.y, box.z]}>
      <group ref={ref}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <coneGeometry args={[0.14, 0.2, 4]} />
            <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={1.2} transparent depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** An ice platform that cracks (jitters) when stepped on, then falls away and
 *  fades, then respawns. Reads the mutable `triggeredAt` set by Player. */
function BreakawayNode({ b }: { b: Breakaway }) {
  const ref = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const now = state.clock.elapsedTime * 1000;
    let ox = 0, oy = 0, oz = 0, opacity = 0.92, vis = true;
    if (b.triggeredAt >= 0) {
      const dt = now - b.triggeredAt;
      if (dt < BREAK_DELAY_MS) {
        const j = (dt / BREAK_DELAY_MS) * 0.09;
        ox = Math.sin(now * 0.05) * j; oz = Math.cos(now * 0.07) * j;
      } else if (dt < BREAK_RESPAWN_MS) {
        const f = (dt - BREAK_DELAY_MS) / (BREAK_RESPAWN_MS - BREAK_DELAY_MS);
        oy = -f * f * 16; opacity = Math.max(0, 0.92 - f * 1.2);
        if (f > 0.9) vis = false;
      }
    }
    ref.current.position.set(b.x + ox, b.y + oy, b.z + oz);
    ref.current.visible = vis;
    if (matRef.current) matRef.current.opacity = opacity;
  });
  return (
    <group ref={ref} position={[b.x, b.y, b.z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[b.hx * 2, b.hy * 2, b.hz * 2]} />
        <meshStandardMaterial ref={matRef} color={b.color} transparent opacity={0.92} roughness={0.08} metalness={0.15} emissive="#bfe8ff" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, b.hy + 0.02, 0]}>
        <boxGeometry args={[b.hx * 1.9, 0.04, b.hz * 1.9]} />
        <meshStandardMaterial color="#eaf7ff" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

export default function World({ data }: { data: WorldData }) {
  return (
    <>
      <MergedStatic meshes={data.meshes} />
      {data.ladders.map((box, i) => <LadderHint key={`l-${i}`} box={box} />)}
      {data.movers.map((mover, i) => <MoverNode key={`mv-${i}`} mover={mover} />)}
      {data.breakaways.map((b, i) => <BreakawayNode key={`bk-${i}`} b={b} />)}
      {data.windmills.map((wm, i) => <WindmillNode key={`wm-${i}`} wm={wm} />)}
      {data.flags.map((f, i) => <FlagNode key={`fl-${i}`} f={f} />)}
      {data.smoke.map((s, i) => <Smoke key={`sm-${i}`} p={s} />)}
      {data.waterfalls.map((w, i) => <WaterfallNode key={`wf-${i}`} w={w} />)}
      {data.waterwheels.map((w, i) => <WaterWheelNode key={`ww-${i}`} wheel={w} />)}
      <Beacon x={data.goal.x} y={data.goal.y} z={data.goal.z} />
    </>
  );
}
