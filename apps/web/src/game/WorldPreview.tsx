import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import SkyDome from './SkyDome';
import World, { generateWorld } from './World';
import Character from './Character';

// ════════════════════════════════════════════════════════════════════════
//  DEV WORLD PREVIEW  —  no socket, no lobby, no player controller.
//  Renders the generated world with the SAME lighting/sky as the real game
//  from a fixed camera, so it can be screenshotted headlessly to validate
//  look & feel:  /d/tower-climb?preview=overview   (or a named preset / coords)
//  Coords override:  ?preview=1&cx=&cy=&cz=&tx=&ty=&tz=
// ════════════════════════════════════════════════════════════════════════

type Vec3 = [number, number, number];
// Floating sky-districts spiral around an OPEN centre (slender decorative peak).
const PRESETS: Record<string, { pos: Vec3; tgt: Vec3; char?: Vec3 }> = {
  overview:  { pos: [22, 34, 26], tgt: [0, 22, 0] },
  far:       { pos: [30, 30, 30], tgt: [0, 20, 0] },
  ground:    { pos: [11, 4, 15], tgt: [0, 3, 2], char: [0, 0.6, 9.5] },
  garden:    { pos: [14, 10, 14], tgt: [-2, 6, -6] },
  windmill:  { pos: [16, 19, 8], tgt: [4, 16, 6] },
  water:     { pos: [-14, 30, 12], tgt: [-6, 27, 5] },
  market:    { pos: [4, 38, -16], tgt: [-4, 34, -8] },
  ice:       { pos: [12, 46, 8], tgt: [0, 42, 0] },
  summit:    { pos: [8, 54, 12], tgt: [-4, 49, 2] },
};

export default function WorldPreview({ preset }: { preset: string }) {
  const world = useMemo(() => generateWorld(1337), []);
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const num = (k: string, d: number): number => {
    const v = q.get(k);
    return v != null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d;
  };
  const base = PRESETS[preset] ?? PRESETS.overview;
  const pos: Vec3 = [num('cx', base.pos[0]), num('cy', base.pos[1]), num('cz', base.pos[2])];
  const tgt: Vec3 = [num('tx', base.tgt[0]), num('ty', base.tgt[1]), num('tz', base.tgt[2])];
  const char = base.char;

  return (
    <div className="fixed inset-0 bg-slate-950 z-40">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance', stencil: false, alpha: false }}
        camera={{ position: pos, fov: 60, near: 0.1, far: 5000 }}
        onCreated={({ camera }) => camera.lookAt(tgt[0], tgt[1], tgt[2])}
      >
        <SkyDome
          topColor="#2f6db8" midColor="#a5cce9" horizonColor="#ffd3a0"
          groundColor="#a87c54" sunDirection={[0.4, 0.55, 0.7]} sunColor="#ffe5b0"
        />
        <fog attach="fog" args={['#cfe1f2', 220, 800]} />
        <hemisphereLight args={['#fff0c8', '#3e5a78', 0.5]} />
        <ambientLight intensity={0.22} color="#fde68a" />
        <directionalLight
          position={[50, 60, 30]} intensity={1.5} color="#ffe5b0" castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048}
          shadow-camera-left={-60} shadow-camera-right={60}
          shadow-camera-top={60} shadow-camera-bottom={-60}
          shadow-camera-near={1} shadow-camera-far={300} shadow-bias={-0.0002}
        />
        <World data={world} />
        {char && (
          <group position={char}>
            <Character variant={6} state="idle" />
          </group>
        )}
      </Canvas>
      <div className="absolute top-2 left-2 text-white text-[11px] font-mono bg-black/60 px-2 py-1 rounded pointer-events-none">
        preview: {preset} · cam [{pos.map((n) => n.toFixed(0)).join(', ')}] → [{tgt.map((n) => n.toFixed(0)).join(', ')}]
      </div>
    </div>
  );
}
