import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import Player from './Player';
import RemotePlayer from './RemotePlayer';
import Spectator from './Spectator';
import SkyDome from './SkyDome';
import World, { generateWorld } from './World';
import { spawnFor } from './worldgen';
import CheatMenu, { DEFAULT_CHEATS, type Cheats } from './CheatMenu';
import AdminMenu from './AdminMenu';
import DebugPanel from './DebugPanel';
import HUD from './HUD';
import TouchControls from './controls/TouchControls';
import { useKeyboard } from './controls/useKeyboard';
import { useMouseLook } from './controls/useMouseLook';
import { input } from './controls/input';
import type { AuthStatus, GameSnapshot, LocalInput, LobbyState, Role } from '@pwa-demo/shared';
import { getSocket } from '../lib/socket';

/** Kick off shader compilation for every material in the scene up-front.
 *  Without this, Three.js compiles each material lazily on its first draw
 *  call — which on Firefox can take 50-100ms per program, causing meshes to
 *  visibly "pop in" during the first few seconds of gameplay. With
 *  `compileAsync` and KHR_parallel_shader_compile (supported by modern
 *  Firefox / Chrome) all programs link in parallel before the first frame. */
function ShaderPrecompiler() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const r = gl as unknown as {
      compileAsync?: (scene: THREE.Scene, camera: THREE.Camera) => Promise<unknown>;
    };
    if (typeof r.compileAsync === 'function') {
      r.compileAsync(scene, camera).catch(() => {});
    } else {
      // Fallback: synchronous compile. Slower but matches Three.js's normal
      // lazy behaviour, just front-loaded.
      gl.compile(scene, camera);
    }
  }, [gl, scene, camera]);
  return null;
}

export default function GameCanvas({
  lobby,
  selfId,
  variant,
  role,
  onLeave,
}: {
  lobby: LobbyState;
  selfId: string;
  variant: number;
  role: Role;
  onLeave: () => void;
}) {
  const world = useMemo(() => generateWorld(1337), []);
  const spawn = useMemo(() => spawnFor(selfId), [selfId]);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [jumpsUsed, setJumpsUsed] = useState(0);
  const [cheats, setCheats] = useState<Cheats>(DEFAULT_CHEATS);
  const [cheatsOpen, setCheatsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myPing, setMyPing] = useState<number | null>(null);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const myStateRef = useRef({ y: spawn.y, maxY: spawn.y });

  const isHost = lobby.hostId === selfId;
  const canAdmin = isHost || isAdmin;
  const paused = lobby.paused ?? false;

  // Server tells us what privileges the handshake earned — single source of
  // truth, beats trusting localStorage alone.
  useEffect(() => {
    const s = getSocket();
    const onAuth = (status: AuthStatus) => setIsAdmin(status.isAdmin);
    s.on('auth:status', onAuth);
    return () => { s.off('auth:status', onAuth); };
  }, []);

  // Ctrl+C toggles the cheat menu; Ctrl+A toggles admin menu (host or admin-token holder)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.code === 'KeyC' || e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setCheatsOpen((v) => !v);
      }
      if (e.ctrlKey && (e.code === 'KeyA' || e.key === 'a' || e.key === 'A') && canAdmin) {
        e.preventDefault();
        setAdminOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canAdmin]);


  // Periodic ping probe so the server tracks each player's ping
  useEffect(() => {
    const s = getSocket();
    const probe = () => s.emit('ping:probe', Date.now());
    probe();
    const id = setInterval(probe, 3000);
    const onPong = (sentAt: number) => setMyPing(Date.now() - sentAt);
    s.on('pong:reply', onPong);
    return () => {
      clearInterval(id);
      s.off('pong:reply', onPong);
    };
  }, []);

  useKeyboard(true);
  const { locked } = useMouseLook(canvasEl, !isTouch);

  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    const s = getSocket();
    const onSnap = (snap: GameSnapshot) => {
      if (snap.lobbyId === lobby.id) {
        setSnapshot(snap);
        setSnapshotCount((n) => n + 1);
      }
    };
    s.on('game:snapshot', onSnap);
    return () => { s.off('game:snapshot', onSnap); };
  }, [lobby.id]);

  const sendInput = (i: LocalInput) => {
    if (paused) return; // freeze input when game is paused
    getSocket().emit('game:input', i);
    myStateRef.current.y = i.y;
    if (i.y > myStateRef.current.maxY) myStateRef.current.maxY = i.y;
  };

  const others = snapshot?.players.filter((p) => p.id !== selfId && p.role === 'player') ?? [];
  const mySnap = snapshot?.players.find((p) => p.id === selfId);
  const myMaxHeight = Math.max(mySnap?.maxHeight ?? 0, myStateRef.current.maxY);

  // Map socketId → ping from latest snapshot (populated once server starts tracking pings)
  const snapPings: Record<string, number | null> = {};
  for (const p of snapshot?.players ?? []) snapPings[p.id] = p.ping ?? null;

  return (
    <div className="fixed inset-0 bg-slate-950 z-40">
      <Canvas
        shadows
        // Cap pixel ratio: retina screens otherwise render at 2-3x, which
        // Firefox's compositor handles much less efficiently than Chrome.
        // 1.5x retains visible sharpness with a huge fill-rate saving.
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          // Hint to Firefox to pick the discrete GPU when available.
          powerPreference: 'high-performance',
          // We never read stencil or use a transparent canvas — turning these
          // off frees framebuffer memory (matters on Firefox, where the
          // default allocation is more conservative than Chrome).
          stencil: false,
          alpha: false,
        }}
        camera={{ position: [10, 6, 10], fov: 65, near: 0.1, far: 5000 }}
        onCreated={({ gl }) => setCanvasEl(gl.domElement)}
      >
        <Suspense fallback={null}>
          <ShaderPrecompiler />
          {/* Custom shader skydome — guaranteed visible gradient + soft sun */}
          <SkyDome
            topColor="#2f6db8"
            midColor="#a5cce9"
            horizonColor="#ffd3a0"
            groundColor="#a87c54"
            sunDirection={[0.4, 0.55, 0.7]}
            sunColor="#ffe5b0"
          />
          {/* Subtle far-distance fog — only kicks in past the playable area */}
          <fog attach="fog" args={['#cfe1f2', 220, 800]} />
          <hemisphereLight args={['#fff0c8', '#3e5a78', 0.5]} />
          <ambientLight intensity={0.22} color="#fde68a" />
          <directionalLight
            position={[50, 60, 30]}
            intensity={1.5}
            color="#ffe5b0"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-60}
            shadow-camera-right={60}
            shadow-camera-top={60}
            shadow-camera-bottom={-60}
            shadow-camera-near={1}
            shadow-camera-far={300}
            shadow-bias={-0.0002}
          />
          <World data={world} />
          {role === 'player' ? (
            <Player
              variant={variant}
              boxes={world.boxes}
              ladders={world.ladders}
              movers={world.movers}
              spawn={spawn}
              cheats={cheats}
              onInput={sendInput}
              onJumpsChange={setJumpsUsed}
            />
          ) : (
            <Spectator />
          )}
          {others.map((p) => (
            <RemotePlayer
              key={p.id}
              variant={p.character}
              displayName={p.displayName}
              isHost={p.isHost}
              latestX={p.x}
              latestY={p.y}
              latestZ={p.z}
              latestYaw={p.yaw}
              latestState={p.state}
              serverTime={snapshot?.t ?? 0}
            />
          ))}
        </Suspense>
      </Canvas>

      <HUD
        myHeight={myStateRef.current.y}
        myMaxHeight={myMaxHeight}
        players={snapshot?.players ?? []}
        selfId={selfId}
        pointerLocked={locked}
        jumpsUsed={jumpsUsed}
        isPlayer={role === 'player'}
        debugOpen={debugOpen}
        onToggleDebug={() => setDebugOpen((v) => !v)}
      />

      <TouchControls active={isTouch} />

      <CheatMenu
        open={cheatsOpen}
        cheats={cheats}
        onChange={setCheats}
        onClose={() => setCheatsOpen(false)}
      />

      <AdminMenu
        open={adminOpen}
        lobby={lobby}
        selfId={selfId}
        snapPings={snapPings}
        onClose={() => setAdminOpen(false)}
      />

      <DebugPanel
        open={debugOpen}
        onClose={() => setDebugOpen(false)}
        players={snapshot?.players ?? []}
        selfId={selfId}
        myPing={myPing}
        snapshotCount={snapshotCount}
        isAdmin={isAdmin}
      />

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="bg-slate-950/80 backdrop-blur border border-amber-500/40 rounded-xl px-6 py-4 text-center">
            <div className="text-amber-300 font-semibold text-lg tracking-wide">Game paused</div>
            {isHost && (
              <div className="text-slate-400 text-xs mt-1">Press Ctrl+A to resume</div>
            )}
          </div>
        </div>
      )}

      {(cheats.fly || cheats.infiniteJumps) && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 text-[10px] text-amber-200 bg-slate-950/60 border border-amber-500/30 rounded px-2 py-1 font-mono uppercase tracking-wider">
          cheats: {cheats.fly ? 'fly' : ''}{cheats.fly && cheats.infiniteJumps ? ' · ' : ''}{cheats.infiniteJumps ? '∞ jumps' : ''}
        </div>
      )}

      <div className="absolute top-4 right-1/2 translate-x-1/2 z-30 flex gap-2">
        {canAdmin && (
          <button
            onClick={() => setAdminOpen((v) => !v)}
            title="Admin panel (Ctrl+A)"
            className="bg-slate-900/80 backdrop-blur border border-amber-500/30 hover:bg-slate-800 text-amber-300 text-xs px-3 py-1.5 rounded-md"
          >
            ★ Admin
          </button>
        )}
        <button
          onClick={onLeave}
          className="bg-slate-900/80 backdrop-blur border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs px-3 py-1.5 rounded-md"
        >
          Leave lobby
        </button>
      </div>

      {!locked && !isTouch && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="bg-slate-950/80 backdrop-blur border border-slate-700 rounded-lg px-4 py-3 text-center text-slate-300 text-sm max-w-sm">
            {role === 'player'
              ? 'click anywhere to capture mouse — climb to the glowing orb!'
              : 'click anywhere to capture mouse — spectator mode, WASD to fly'}
          </div>
        </div>
      )}
    </div>
  );
}
