import { Profiler, type ProfilerOnRenderCallback, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { PCFSoftShadowMap } from 'three';
import Player from './Player';
import { triggerWave } from './Character';
import RemotePlayer from './RemotePlayer';
import Spectator from './Spectator';
import SkyDome from './SkyDome';
import World, { generateWorld } from './World';
import { spawnFor } from './worldgen';
import CheatMenu, { DEFAULT_CHEATS, type Cheats } from './CheatMenu';
import AdminMenu from './AdminMenu';
import { SettingsMenu } from './SettingsMenu';
import { NetworkPerfOverlay } from './NetworkPerf';
import HUD from './HUD';
import { RenderStatsCollector, RenderPerfOverlay, reportCommit } from './RenderPerf';
import { resolveInitialShadows, resolveShadowRes, saveShadowPref } from './settings';
import TouchControls from './controls/TouchControls';
import { useKeyboard } from './controls/useKeyboard';
import { useMouseLook } from './controls/useMouseLook';
import { input } from './controls/input';
import type { AuthStatus, GameSnapshot, DecodedSnapshot, PlayerSnapshot, LocalInput, LobbyState, Role } from '@pwa-demo/shared';
import { PLAYER_STATES } from '@pwa-demo/shared';
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

/** Applies a live shadows on/off toggle without remounting the Canvas: flips the
 *  renderer's shadow map and recompiles every material's shadow code. The INITIAL
 *  state comes from the Canvas `shadows` prop, so the first run skips the (costly)
 *  recompile and only the actual toggles pay for it. */
function ShadowController({ enabled }: { enabled: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const first = useRef(true);
  useEffect(() => {
    gl.shadowMap.enabled = enabled;
    if (enabled) gl.shadowMap.type = PCFSoftShadowMap;
    gl.shadowMap.needsUpdate = true;
    if (first.current) { first.current = false; return; }
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      if (Array.isArray(m)) m.forEach((mm) => { mm.needsUpdate = true; });
      else m.needsUpdate = true;
    });
  }, [enabled, gl, scene]);
  return null;
}

export default function GameCanvas({
  lobby,
  selfId,
  selfClientId,
  variant,
  role,
  onLeave,
}: {
  lobby: LobbyState;
  /** Current socket id — used for transport-level addressing (host check,
   *  admin kick). Changes on reconnect; don't use it to identify "me". */
  selfId: string;
  /** Stable per-tab identity — used to recognize our own avatar regardless of
   *  the current socket id, so a pre-reconnect ghost isn't drawn as a second
   *  player and our deterministic spawn point stays put across reconnects. */
  selfClientId: string;
  variant: number;
  role: Role;
  onLeave: () => void;
}) {
  const world = useMemo(() => generateWorld(1337), []);
  const spawn = useMemo(() => spawnFor(selfClientId), [selfClientId]);
  // Shadows default OFF on software GPUs (the 20-30fps WARP/SwiftShader case)
  // and ON otherwise; a saved choice or `?noshadows` overrides. Live-toggleable
  // from the Settings menu. `?shadowres=1024` shrinks the shadow map.
  const [shadowsOn, setShadowsOn] = useState(resolveInitialShadows);
  const shadowRes = useMemo(resolveShadowRes, []);
  const toggleShadows = (on: boolean) => { setShadowsOn(on); saveShadowPref(on); };
  const [snapshot, setSnapshot] = useState<DecodedSnapshot | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [jumpsUsed, setJumpsUsed] = useState(0);
  const [cheats, setCheats] = useState<Cheats>(DEFAULT_CHEATS);
  const [cheatsOpen, setCheatsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [perfOpen, setPerfOpen] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myPing, setMyPing] = useState<number | null>(null);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [summitReached, setSummitReached] = useState(false);
  // Touch only: lets the player dismiss the summit overlay to reclaim screen
  // space — the Fly/Land touch button keeps flight reachable afterward.
  const [summitDismissed, setSummitDismissed] = useState(false);
  const [flightOn, setFlightOn] = useState(false);
  const [cpBanner, setCpBanner] = useState<string | null>(null);
  const cpTimerRef = useRef<number | null>(null);
  const myStateRef = useRef({ y: spawn.y, maxY: spawn.y });
  // Latest roster, read by the snapshot decoder without re-subscribing the
  // socket listener on every lobby:state update.
  const rosterRef = useRef(lobby.players);
  rosterRef.current = lobby.players;

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
      // F toggles earned flight once the summit has been reached — but never
      // when typing into a form field (admin name / max-players, etc.).
      if (!e.ctrlKey && e.code === 'KeyF' && summitReached) {
        const tgt = e.target as HTMLElement | null;
        const typing = !!tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable);
        if (!typing) {
          e.preventDefault();
          setFlightOn((v) => !v);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canAdmin, summitReached]);


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

  // Cancel any pending checkpoint-banner timer on unmount (leave lobby etc.)
  useEffect(() => () => { if (cpTimerRef.current) window.clearTimeout(cpTimerRef.current); }, []);

  useKeyboard(true);
  // Pause drops pointer lock and refuses to re-acquire it (third arg = allow
  // lock) — so a paused game can't be steered with the mouse.
  const { locked } = useMouseLook(canvasEl, !isTouch, !paused);

  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    const s = getSocket();
    const onSnap = (snap: GameSnapshot) => {
      if (snap.lobbyId !== lobby.id) return;
      // The wire snapshot carries only quantized positions (PackedPlayer tuples).
      // Join each against the live roster to rebuild the rich PlayerSnapshot the
      // rest of the UI consumes; the live maxHeight/ping from the tuple override
      // the roster's slower-updating copies.
      const roster = new Map(rosterRef.current.map((p) => [p.id, p]));
      const players: PlayerSnapshot[] = [];
      for (const [id, x, y, z, yaw, st, mh, pg] of snap.players) {
        const r = roster.get(id);
        if (!r) continue; // just joined — shows up once its lobby:state lands
        players.push({
          ...r,
          x: x / 100,
          y: y / 100,
          z: z / 100,
          yaw: yaw / 100,
          state: PLAYER_STATES[st] ?? 'idle',
          maxHeight: mh / 100,
          ping: pg < 0 ? null : pg,
        });
      }
      setSnapshot({ lobbyId: snap.lobbyId, t: snap.t, players });
      setSnapshotCount((n) => n + 1);
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

  const handleReachSummit = () => {
    setSummitReached(true);
    triggerWave(2400); // everyone waves to celebrate
  };
  const handleCheckpoint = (name: string) => {
    setCpBanner(name);
    if (cpTimerRef.current) window.clearTimeout(cpTimerRef.current);
    cpTimerRef.current = window.setTimeout(() => setCpBanner(null), 2600);
  };

  // Flight is active from the dev cheat OR the earned summit reward. The reward
  // version is capped just above the summit and softly leashed to the map.
  const flightUnlocked = summitReached;
  const flying = cheats.fly || (flightUnlocked && flightOn);
  const flyProp = {
    active: flying,
    capY: cheats.fly ? Infinity : world.summitY + 6,
    minY: cheats.fly ? -Infinity : 0.4,
    leashR: cheats.fly ? Infinity : 95,
  };

  // Identify ourselves by the stable clientId, NOT the socket id: after a
  // reconnect our pre-reconnect record can still be in the snapshot under its
  // old (now-dead) socket id. Filtering on selfId would let that ghost through
  // as a "remote" player and draw a second copy of us.
  const others = snapshot?.players.filter((p) => p.clientId !== selfClientId && p.role === 'player') ?? [];
  const mySnap = snapshot?.players.find((p) => p.clientId === selfClientId);
  const myMaxHeight = Math.max(mySnap?.maxHeight ?? 0, myStateRef.current.maxY);

  // Map socketId → ping from latest snapshot (populated once server starts tracking pings)
  const snapPings: Record<string, number | null> = {};
  for (const p of snapshot?.players ?? []) snapPings[p.id] = p.ping ?? null;

  // Feed React commit durations to the perf overlay so a freeze can be blamed
  // on (or cleared of) the 20Hz re-render. Two trees: DOM (HUD/menus) and the
  // 3D scene (which re-reconciles every snapshot as player props change).
  const onDomRender: ProfilerOnRenderCallback = (_id, _phase, actual) => reportCommit('dom', actual);
  const onSceneRender: ProfilerOnRenderCallback = (_id, _phase, actual) => reportCommit('scene', actual);

  return (
    <Profiler id="dom" onRender={onDomRender}>
    {/* The whole play screen opts out of our custom pull-to-refresh: the game
        owns every vertical drag, and the touch controls / HUD sit over the
        canvas as plain divs — so excluding just the canvas would still let a
        downward swipe starting on the joystick or a button trigger a reload.
        PullToRefresh's canStart() honors [data-no-pull-refresh] via closest(). */}
    {/* select-none: camera drags (and any mouse-look before pointer lock) must
        never start a text selection on the HUD / overlays sitting over the
        canvas. Editable form fields (admin menu) keep working — user-select:none
        does not apply to editing hosts. */}
    <div data-no-pull-refresh className="fixed inset-0 bg-slate-950 z-40 select-none">
      <Canvas
        shadows={shadowsOn}
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
          <Profiler id="scene" onRender={onSceneRender}>
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
            castShadow={shadowsOn}
            shadow-mapSize-width={shadowRes}
            shadow-mapSize-height={shadowRes}
            shadow-camera-left={-60}
            shadow-camera-right={60}
            shadow-camera-top={60}
            shadow-camera-bottom={-60}
            shadow-camera-near={1}
            shadow-camera-far={300}
            shadow-bias={-0.0002}
          />
          <World data={world} />
          <ShadowController enabled={shadowsOn} />
          {perfOpen && <RenderStatsCollector />}
          {role === 'player' ? (
            <Player
              variant={variant}
              boxes={world.boxes}
              ladders={world.ladders}
              movers={world.movers}
              breakaways={world.breakaways}
              spawn={spawn}
              cheats={cheats}
              fly={flyProp}
              paused={paused}
              goal={world.goal}
              checkpoints={world.checkpoints}
              onInput={sendInput}
              onJumpsChange={setJumpsUsed}
              onReachSummit={handleReachSummit}
              onCheckpoint={handleCheckpoint}
            />
          ) : (
            <Spectator paused={paused} />
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
          </Profiler>
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
        zones={world.zones}
        summitY={world.summitY}
        flying={flying}
        flightUnlocked={flightUnlocked}
      />

      <TouchControls
        active={isTouch && !paused}
        flightUnlocked={flightUnlocked}
        flying={flying}
        onToggleFly={() => setFlightOn((v) => !v)}
      />

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

      <SettingsMenu
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        shadowsOn={shadowsOn}
        onToggleShadows={toggleShadows}
        onOpenPerf={() => setPerfOpen(true)}
        onOpenNetwork={() => setNetworkOpen(true)}
      />
      <RenderPerfOverlay open={perfOpen} onClose={() => setPerfOpen(false)} />
      <NetworkPerfOverlay
        open={networkOpen}
        onClose={() => setNetworkOpen(false)}
        players={snapshot?.players ?? []}
        selfId={selfId}
        myPing={myPing}
        snapshotCount={snapshotCount}
      />

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="bg-slate-950/80 backdrop-blur border border-amber-500/40 rounded-xl px-6 py-4 text-center">
            <div className="text-amber-300 font-semibold text-lg tracking-wide">Game paused</div>
            <div className="text-slate-400 text-xs mt-1">
              {canAdmin ? 'Press Ctrl+A to resume' : 'Waiting for the host to resume'}
            </div>
          </div>
        </div>
      )}

      {(cheats.fly || cheats.infiniteJumps) && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 text-[10px] text-amber-200 bg-slate-950/60 border border-amber-500/30 rounded px-2 py-1 font-mono uppercase tracking-wider">
          cheats: {cheats.fly ? 'fly' : ''}{cheats.fly && cheats.infiniteJumps ? ' · ' : ''}{cheats.infiniteJumps ? '∞ jumps' : ''}
        </div>
      )}

      {/* Checkpoint banner — transient */}
      {cpBanner && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-emerald-900/85 backdrop-blur border border-emerald-400/50 rounded-lg px-4 py-2 text-emerald-100 text-sm font-semibold tracking-wide shadow-lg">
            ✓ Checkpoint — {cpBanner}
          </div>
        </div>
      )}

      {/* Summit reached → offer flight. On touch the overlay is dismissable
          (the Fly/Land touch button keeps flight reachable after dismissing). */}
      {summitReached && !(isTouch && summitDismissed) && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
          <div className="relative bg-slate-950/85 backdrop-blur border border-amber-400/50 rounded-xl px-5 py-3 text-center pointer-events-auto shadow-2xl">
            {isTouch && (
              <button
                type="button"
                onClick={() => setSummitDismissed(true)}
                aria-label="Dismiss"
                className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-slate-800 border border-slate-600 text-slate-300 text-xs leading-none shadow-md active:scale-95"
              >
                ✕
              </button>
            )}
            <div className="text-amber-300 font-bold text-lg">🏔 You reached the summit!</div>
            <div className="text-slate-300 text-xs mt-1">
              {flying ? 'Flying — Space up · Shift down · F to land' : 'Flight unlocked — soar over the whole world'}
            </div>
            <button
              onClick={() => setFlightOn((v) => !v)}
              className="mt-2 bg-amber-500/90 hover:bg-amber-400 text-slate-900 font-semibold text-sm px-4 py-1.5 rounded-md"
            >
              {flying ? 'Land (F)' : 'Take flight ✈ (F)'}
            </button>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-1/2 translate-x-1/2 z-30 flex gap-2">
        <button
          onClick={() => { if (!settingsOpen) document.exitPointerLock?.(); setSettingsOpen((v) => !v); }}
          title="Settings"
          className="bg-slate-900/80 backdrop-blur border border-amber-500/30 hover:bg-slate-800 text-amber-300 text-base leading-none px-3 py-1.5 rounded-md"
        >
          ⚙
        </button>
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

      {!locked && !isTouch && !paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="bg-slate-950/80 backdrop-blur border border-slate-700 rounded-lg px-4 py-3 text-center text-slate-300 text-sm max-w-sm">
            {role === 'player'
              ? 'click anywhere to capture mouse — climb to the summit beacon!'
              : 'click anywhere to capture mouse — spectator mode, WASD to fly'}
          </div>
        </div>
      )}
    </div>
    </Profiler>
  );
}
