import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Character from '../Character';
import { CHARACTERS } from '../characters';

export default function CharacterPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-stretch">
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden aspect-square">
        <Canvas camera={{ position: [0, 1.6, 3], fov: 35 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 2]} intensity={1.2} />
          <group position={[0, -0.8, 0]}>
            <Character variant={value} state="idle" />
          </group>
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            target={[0, 0.4, 0]}
            autoRotate
            autoRotateSpeed={2.5}
          />
        </Canvas>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 content-start">
        {CHARACTERS.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              className={`bg-slate-900 border rounded-lg p-2 transition text-left flex flex-col gap-1 ${
                active
                  ? 'border-brand-500 ring-2 ring-brand-500/50'
                  : 'border-slate-800 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-4 h-4 rounded-full ring-1 ring-slate-700"
                  style={{ background: c.bodyColor }}
                />
                <span className="text-sm font-medium truncate">{c.name}</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {c.body} · {c.accessory}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
