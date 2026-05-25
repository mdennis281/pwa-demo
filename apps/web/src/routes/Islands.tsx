/**
 * Floating-islands sensor demo.
 *
 * Camera lives inside a 3m glass observation box. Yaw/pitch comes from
 * DeviceOrientationEvent.alpha/beta; translation comes from pedestrian-style
 * step detection on DeviceMotionEvent — a peak in |accel| above threshold
 * advances the camera by `STEP_LENGTH` meters in the current heading
 * direction. Box walls soft-clamp the position so PDR drift never escapes
 * the visible chamber.
 *
 * Requires a physical mobile device (laptops return null from these events)
 * and HTTPS for non-localhost (iOS Safari refuses sensor permission over
 * plain HTTP unless you're hitting `localhost`).
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyDome from '../game/SkyDome';

// ─── tunables ─────────────────────────────────────────────────────────────

const BOX_SIZE = 3;                     // inner cube edge (m)
const BOX_HALF = BOX_SIZE / 2;
const EYE_HEIGHT = 1.6;                 // camera Y, in meters above box floor
const STEP_LENGTH = 0.65;               // average human stride (m)
const STEP_THRESHOLD = 11.5;            // |accel| (m/s²) to count as a heel-strike
const STEP_REFRACTORY_MS = 280;         // ignore peaks closer than this
const ISLAND_COUNT = 9;
const ISLAND_INNER_RADIUS = 18;
const ISLAND_OUTER_RADIUS = 70;

// ─── shared sensor refs (read by the in-canvas camera updater) ────────────

type SensorState = {
  /** Calibrated heading in radians (0 = facing world -Z, our "north"). */
  yaw: number;
  /** Pitch in radians. */
  pitch: number;
  /** Number of detected steps since session start (cumulative). */
  steps: number;
  /** Step delta for the camera updater to consume on the next frame. */
  pendingStep: number;
  /** Player position inside the box (XZ), clamped to [-BOX_HALF, BOX_HALF]. */
  px: number;
  pz: number;
  /** alpha (deg) snapshot subtracted to call the current facing "forward". */
  alphaOffsetDeg: number;
  /** Last raw alpha (for recalibration). */
  lastRawAlphaDeg: number;
};

// ─── route component ──────────────────────────────────────────────────────

type PermState = 'pending' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export default function Islands() {
  const navigate = useNavigate();
  const [perm, setPerm] = useState<PermState>(() => {
    if (typeof window === 'undefined') return 'unsupported';
    if (!('DeviceMotionEvent' in window) || !('DeviceOrientationEvent' in window)) {
      return 'unsupported';
    }
    return 'pending';
  });
  const [err, setErr] = useState<string | null>(null);

  function goBack() {
    // navigate(-1) is a no-op (or sends user off-app) when /islands was the
    // landing page. Fall back to home so the back button is always meaningful.
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  const sensor = useRef<SensorState>({
    yaw: 0,
    pitch: 0,
    steps: 0,
    pendingStep: 0,
    px: 0,
    pz: 0,
    alphaOffsetDeg: 0,
    lastRawAlphaDeg: 0,
  });

  // For the HUD readout — sampled at 4Hz so we don't re-render the React tree
  // every frame.
  const [hud, setHud] = useState({ steps: 0, heading: 0, hasOrientation: false });

  // Step detector internals — kept in refs so we don't bust them on render.
  const stepCtx = useRef({ lastStepAt: 0, prevAbove: false });

  async function requestPerm() {
    setErr(null);
    setPerm('requesting');
    try {
      const DM = DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<PermissionState | 'granted' | 'denied'>;
      };
      const DO = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<PermissionState | 'granted' | 'denied'>;
      };
      // iOS-style: must request explicitly. Android Chrome: methods absent,
      // events just fire.
      if (typeof DM.requestPermission === 'function') {
        const r = await DM.requestPermission();
        if (r !== 'granted') { setPerm('denied'); return; }
      }
      if (typeof DO.requestPermission === 'function') {
        const r = await DO.requestPermission();
        if (r !== 'granted') { setPerm('denied'); return; }
      }
      setPerm('granted');
    } catch (e) {
      setErr((e as Error).message);
      setPerm('denied');
    }
  }

  // Attach the sensor listeners once permission is granted.
  useEffect(() => {
    if (perm !== 'granted') return;
    const s = sensor.current;

    function onOrientation(e: DeviceOrientationEvent) {
      // alpha: compass-ish, 0..360, "yaw" rotating around vertical.
      // beta: -180..180, front-back tilt (we use as pitch).
      // Calibrate alpha to whatever direction the user was facing on first event.
      const rawAlpha = e.alpha ?? 0;
      s.lastRawAlphaDeg = rawAlpha;
      if (s.alphaOffsetDeg === 0 && rawAlpha !== 0) {
        s.alphaOffsetDeg = rawAlpha;
      }
      const yawDeg = ((rawAlpha - s.alphaOffsetDeg) + 540) % 360 - 180; // -180..180
      // alpha increases CCW (viewed from above) per the W3C spec; THREE Y+
      // rotation is also CCW from above. Matching signs makes "turn phone
      // right" pan the world right, which is what the player expects.
      s.yaw = THREE.MathUtils.degToRad(yawDeg);
      // Clamp pitch to keep horizon roughly level; phones held in portrait
      // give beta ~90° at "normal" hold, so subtract 90 and clamp.
      const pitchDeg = THREE.MathUtils.clamp((e.beta ?? 90) - 90, -60, 60);
      s.pitch = THREE.MathUtils.degToRad(pitchDeg);
    }

    function onMotion(e: DeviceMotionEvent) {
      // iOS provides linear acceleration (gravity removed) on .acceleration;
      // Android variants populate accelerationIncludingGravity. Prefer linear,
      // fall back and crudely subtract ~9.8 from magnitude if needed.
      let ax = e.acceleration?.x ?? null;
      let ay = e.acceleration?.y ?? null;
      let az = e.acceleration?.z ?? null;
      let gravityCompensated = ax !== null;
      if (!gravityCompensated) {
        ax = e.accelerationIncludingGravity?.x ?? 0;
        ay = e.accelerationIncludingGravity?.y ?? 0;
        az = e.accelerationIncludingGravity?.z ?? 0;
      }
      const mag = Math.hypot(ax ?? 0, ay ?? 0, az ?? 0);
      // If we had to use including-gravity, the resting magnitude is ~9.8 and
      // a step shows up as a deflection from that — compare against a higher
      // threshold by adding gravity in.
      const threshold = gravityCompensated ? STEP_THRESHOLD - 9.8 : STEP_THRESHOLD;
      const now = performance.now();
      const above = mag > threshold;
      // Rising edge across the threshold, with a refractory window so a single
      // heel-strike can't double-count.
      if (above && !stepCtx.current.prevAbove &&
          now - stepCtx.current.lastStepAt > STEP_REFRACTORY_MS) {
        stepCtx.current.lastStepAt = now;
        s.steps++;
        s.pendingStep++;
      }
      stepCtx.current.prevAbove = above;
    }

    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);
    // 4Hz HUD sampler — cheap re-render driver for the labels.
    const hudId = window.setInterval(() => {
      setHud({
        steps: s.steps,
        heading: Math.round(THREE.MathUtils.radToDeg(-s.yaw) + 360) % 360,
        hasOrientation: s.lastRawAlphaDeg !== 0,
      });
    }, 250);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
      window.clearInterval(hudId);
    };
  }, [perm]);

  function recalibrate() {
    // Set the alpha offset to current raw alpha so the user's current facing
    // becomes the new world-forward.
    sensor.current.alphaOffsetDeg = sensor.current.lastRawAlphaDeg;
  }

  if (perm !== 'granted') {
    return (
      <PermissionGate
        state={perm}
        err={err}
        onStart={requestPerm}
        onBack={goBack}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-40">
      <Canvas
        shadows={false}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance', stencil: false, alpha: false }}
        camera={{ position: [0, EYE_HEIGHT, 0], fov: 70, near: 0.05, far: 3000 }}
      >
        <Suspense fallback={null}>
          {/* Soft pastel sunset sky */}
          <SkyDome
            topColor="#3a2a5e"
            midColor="#c87ea8"
            horizonColor="#ffb88a"
            groundColor="#3a2545"
            sunDirection={[0.6, 0.18, 0.9]}
            sunColor="#ffd8a0"
          />
          <fog attach="fog" args={['#e8b5a5', 30, 350]} />
          <hemisphereLight args={['#ffd7b3', '#3a2545', 0.55]} />
          <ambientLight intensity={0.3} color="#fde6c0" />
          <directionalLight
            position={[40, 18, 80]}
            intensity={1.4}
            color="#ffd2a3"
          />
          <SensorCamera sensor={sensor} />
          <GlassBox />
          <GlassPanel />
          <Islandscape />
          <DriftingMotes />
        </Suspense>
      </Canvas>

      <HUD
        steps={hud.steps}
        heading={hud.heading}
        hasOrientation={hud.hasOrientation}
        onRecalibrate={recalibrate}
        onBack={goBack}
      />
    </div>
  );
}

// ─── permission gate ──────────────────────────────────────────────────────

function PermissionGate({
  state,
  err,
  onStart,
  onBack,
}: {
  state: PermState;
  err: string | null;
  onStart: () => void;
  onBack: () => void;
}) {
  const isMobileLike = typeof window !== 'undefined' && 'ontouchstart' in window;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 px-6">
      {/* Back button — also offset by the safe-area inset so it clears the
          iOS status bar in standalone PWA mode. */}
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 z-10 bg-slate-950/70 backdrop-blur border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-1.5 text-slate-200 text-xs"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        ← back
      </button>
      <div className="max-w-md w-full bg-slate-950/70 backdrop-blur border border-slate-700 rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-white">Floating Islands</h1>
        <p className="text-slate-400 text-sm">
          A glass-box observation deck above a sunset world. Your phone's motion
          and orientation sensors drive the camera: tilt to look around, walk
          a step or two to lean toward a wall.
        </p>

        {state === 'unsupported' && (
          <div className="text-rose-300 text-sm">
            DeviceMotion / DeviceOrientation events aren't available in this browser.
            Open this on a phone.
          </div>
        )}

        {!isMobileLike && state !== 'unsupported' && (
          <div className="text-amber-300 text-sm border border-amber-500/30 bg-amber-500/10 rounded px-3 py-2">
            Looks like a desktop browser — the sensors will likely return null.
            Open this URL on your phone for the real demo.
          </div>
        )}

        {state === 'denied' && (
          <div className="text-rose-300 text-sm">
            Permission denied{err ? ` (${err})` : ''}. On iOS you may need to:
            Settings → Safari → Motion &amp; Orientation Access, then reload.
          </div>
        )}

        <button
          type="button"
          onClick={onStart}
          disabled={state === 'requesting' || state === 'unsupported'}
          className="w-full bg-amber-500/90 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold px-4 py-3 rounded-lg transition"
        >
          {state === 'requesting' ? 'requesting…' : state === 'denied' ? 'try again' : 'tap to start'}
        </button>

        <p className="text-slate-500 text-[10px] leading-relaxed">
          Requires HTTPS or localhost for sensor permission on iOS. If the
          prompt never appears, your origin probably isn't secure.
        </p>
      </div>
    </div>
  );
}

// ─── camera driver ────────────────────────────────────────────────────────

function SensorCamera({ sensor }: { sensor: React.RefObject<SensorState> }) {
  const { camera } = useThree();
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

  useFrame(() => {
    const s = sensor.current;
    if (!s) return;

    // Consume any pending steps as a translation in the current heading.
    // sin/cos with our convention: yaw=0 → facing -Z.
    if (s.pendingStep > 0) {
      const dx = -Math.sin(s.yaw) * STEP_LENGTH * s.pendingStep;
      const dz = -Math.cos(s.yaw) * STEP_LENGTH * s.pendingStep;
      s.px = THREE.MathUtils.clamp(s.px + dx, -BOX_HALF + 0.3, BOX_HALF - 0.3);
      s.pz = THREE.MathUtils.clamp(s.pz + dz, -BOX_HALF + 0.3, BOX_HALF - 0.3);
      s.pendingStep = 0;
    }

    camera.position.set(s.px, EYE_HEIGHT, s.pz);
    euler.set(s.pitch, s.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  });

  return null;
}

// ─── scene pieces ─────────────────────────────────────────────────────────

function GlassBox() {
  // Frame + faintly tinted panes. We want the box to read as a "room" without
  // occluding the view of the outside scene.
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE)), []);
  return (
    <group position={[0, EYE_HEIGHT, 0]}>
      {/* glass panes — barely visible, just enough to catch a highlight */}
      <mesh>
        <boxGeometry args={[BOX_SIZE, BOX_SIZE, BOX_SIZE]} />
        <meshPhysicalMaterial
          color="#a3c5e0"
          transparent
          opacity={0.06}
          roughness={0.05}
          metalness={0}
          transmission={0.9}
          thickness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* edge frame in warm brass — reads as a chamber, gives a focal point */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#f7c98a" transparent opacity={0.7} />
      </lineSegments>
      {/* floor below feet — a slightly opaque pad so you don't see directly down */}
      <mesh position={[0, -BOX_HALF + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOX_SIZE, BOX_SIZE]} />
        <meshStandardMaterial color="#2a1f3a" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Standing stained-glass panel just outside the box's front (-Z) face. The
 *  box only spans ~3m so islands at ~20-70m feel far. This panel sits at
 *  ~2.7m and is the only object near enough for stepping to produce obvious
 *  parallax — making the PDR translation legible to the player. */
function GlassPanel() {
  const jewelRef = useRef<THREE.MeshStandardMaterial>(null);
  const panelGeom = useMemo(() => new THREE.BoxGeometry(1.8, 2.4, 0.05), []);
  const frameEdges = useMemo(() => new THREE.EdgesGeometry(panelGeom), [panelGeom]);

  useFrame(() => {
    if (!jewelRef.current) return;
    jewelRef.current.emissiveIntensity = 1.6 + Math.sin(performance.now() / 700) * 0.5;
  });

  return (
    <group position={[0, EYE_HEIGHT, -(BOX_HALF + 1.5)]}>
      {/* tinted glass backing — translucent enough that islands stay visible behind */}
      <mesh geometry={panelGeom}>
        <meshPhysicalMaterial
          color="#c7a8e0"
          transparent
          opacity={0.18}
          roughness={0.08}
          transmission={0.75}
          thickness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* brass frame */}
      <lineSegments geometry={frameEdges}>
        <lineBasicMaterial color="#f7c98a" />
      </lineSegments>
      {/* concentric gold rings — each pair of (radius, tube) was picked so they
          all read clearly at the spawn distance (~2.7m) and grow noticeably as
          the player steps forward (~1.5m closer at the wall clamp). */}
      {[0.35, 0.6, 0.85, 1.05].map((r) => (
        <mesh key={r} position={[0, 0, 0.03]}>
          <torusGeometry args={[r, 0.018, 8, 56]} />
          <meshBasicMaterial color="#f7c98a" />
        </mesh>
      ))}
      {/* four small jewels at the cardinal positions */}
      {[[0, 1.05, 0.04], [0, -1.05, 0.04], [-0.85, 0, 0.04], [0.85, 0, 0.04]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#f7c98a" emissive="#ffd385" emissiveIntensity={1.4} />
        </mesh>
      ))}
      {/* centerpiece — pulses softly so even at rest there's a focal beat */}
      <mesh position={[0, 0, 0.06]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial ref={jewelRef} color="#fff1c2" emissive="#ffe5b0" emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

/** Deterministic island layout. Position, scale, hue, and bob phase are all
 *  seeded so the scene composition is stable across reloads (looks nicer when
 *  the user comes back to the same view). */
function Islandscape() {
  const islands = useMemo(() => generateIslands(ISLAND_COUNT), []);
  return (
    <group>
      {islands.map((i, idx) => (
        <Island key={idx} {...i} />
      ))}
    </group>
  );
}

type IslandDef = {
  position: [number, number, number];
  baseRadius: number;
  topRadius: number;
  baseHeight: number;
  hue: number;
  bobPhase: number;
  bobAmp: number;
  trees: { x: number; z: number; h: number; r: number }[];
  pillar?: { h: number; w: number };
};

function generateIslands(n: number): IslandDef[] {
  // Tiny seeded RNG so the layout is deterministic.
  let seed = 0x9e3779b1;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const out: IslandDef[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + rand() * 0.6;
    const radius = ISLAND_INNER_RADIUS + rand() * (ISLAND_OUTER_RADIUS - ISLAND_INNER_RADIUS);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = (rand() - 0.5) * 14 - 2; // slight vertical scatter
    const baseRadius = 3 + rand() * 5;
    const topRadius = baseRadius * (0.85 + rand() * 0.2);
    const baseHeight = 3 + rand() * 5;
    const hue = 100 + rand() * 30; // greens to yellow-greens
    const treeCount = 2 + Math.floor(rand() * 5);
    const trees = Array.from({ length: treeCount }, () => {
      const ta = rand() * Math.PI * 2;
      const tr = rand() * topRadius * 0.7;
      return {
        x: Math.cos(ta) * tr,
        z: Math.sin(ta) * tr,
        h: 1.2 + rand() * 1.6,
        r: 0.45 + rand() * 0.5,
      };
    });
    const pillar = rand() > 0.7
      ? { h: 3 + rand() * 4, w: 0.8 + rand() * 0.6 }
      : undefined;
    out.push({
      position: [x, y, z],
      baseRadius,
      topRadius,
      baseHeight,
      hue,
      bobPhase: rand() * Math.PI * 2,
      bobAmp: 0.15 + rand() * 0.3,
      trees,
      pillar,
    });
  }
  return out;
}

function Island({
  position,
  baseRadius,
  topRadius,
  baseHeight,
  hue,
  bobPhase,
  bobAmp,
  trees,
  pillar,
}: IslandDef) {
  const ref = useRef<THREE.Group>(null);
  const grassColor = useMemo(() => new THREE.Color().setHSL(hue / 360, 0.55, 0.45), [hue]);
  const rockColor = useMemo(() => new THREE.Color().setHSL((hue - 60) / 360, 0.3, 0.28), [hue]);
  const trunkColor = useMemo(() => new THREE.Color('#5a3a22'), []);
  const foliageColor = useMemo(() => new THREE.Color().setHSL(hue / 360, 0.5, 0.32), [hue]);
  const pillarColor = useMemo(() => new THREE.Color('#d9b48a'), []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    // Bob up and down lazily so the scene feels alive without distracting.
    const t = performance.now() / 1000;
    ref.current.position.y = position[1] + Math.sin(t * 0.4 + bobPhase) * bobAmp;
    ref.current.rotation.y += dt * 0.01; // very slow turn
  });

  return (
    <group ref={ref} position={position}>
      {/* upside-down rocky cone (point down) — quintessential floating-island silhouette */}
      <mesh position={[0, -baseHeight / 2, 0]}>
        <coneGeometry args={[baseRadius, baseHeight, 6]} />
        <meshStandardMaterial color={rockColor} flatShading roughness={0.95} />
      </mesh>
      {/* grass cap */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[topRadius, baseRadius * 1.05, 0.6, 8]} />
        <meshStandardMaterial color={grassColor} roughness={0.9} flatShading />
      </mesh>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0.6, t.z]}>
          <mesh position={[0, t.h / 2, 0]}>
            <cylinderGeometry args={[t.r * 0.3, t.r * 0.4, t.h, 6]} />
            <meshStandardMaterial color={trunkColor} roughness={1} />
          </mesh>
          <mesh position={[0, t.h + t.r * 0.4, 0]}>
            <icosahedronGeometry args={[t.r, 0]} />
            <meshStandardMaterial color={foliageColor} flatShading roughness={0.9} />
          </mesh>
        </group>
      ))}
      {pillar && (
        <mesh position={[0, 0.6 + pillar.h / 2, 0]}>
          <boxGeometry args={[pillar.w, pillar.h, pillar.w]} />
          <meshStandardMaterial color={pillarColor} roughness={0.7} />
        </mesh>
      )}
    </group>
  );
}

/** Slowly drifting motes — gives the air a sense of scale + atmospheric depth. */
function DriftingMotes() {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 220;
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = Math.random() * 30 - 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const pos = (ref.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3 + 1] += dt * 0.25;
      if (pos[i * 3 + 1] > 30) pos[i * 3 + 1] = -5;
    }
    (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial size={0.08} color="#ffe6c8" transparent opacity={0.55} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ─── HUD ──────────────────────────────────────────────────────────────────

function HUD({
  steps,
  heading,
  hasOrientation,
  onRecalibrate,
  onBack,
}: {
  steps: number;
  heading: number;
  hasOrientation: boolean;
  onRecalibrate: () => void;
  onBack: () => void;
}) {
  // env(safe-area-inset-*) is iOS-PWA-aware — when the app is installed and
  // running in standalone mode, the top inset accounts for the notch/status
  // bar (where the clock + battery live). Falls back to 0 in browser tabs.
  const topInset = 'calc(env(safe-area-inset-top, 0px) + 1rem)';
  const bottomInset = 'calc(env(safe-area-inset-bottom, 0px) + 1rem)';
  return (
    <div className="absolute inset-0 pointer-events-none z-10 text-white font-mono text-xs">
      {/* Top-left stack: back button + sensors readout */}
      <div
        className="absolute left-4 pointer-events-auto flex flex-col gap-2"
        style={{ top: topInset }}
      >
        <button
          type="button"
          onClick={onBack}
          className="self-start bg-slate-950/70 backdrop-blur border border-slate-800 hover:border-slate-500 rounded-lg px-3 py-1.5 text-slate-200"
        >
          ← back
        </button>
        <div className="bg-slate-950/70 backdrop-blur border border-slate-800 rounded-lg px-3 py-2">
          <div className="text-slate-400 text-[10px] uppercase tracking-wider">sensors</div>
          <div className="tabular-nums">steps: <span className="text-amber-300">{steps}</span></div>
          <div className="tabular-nums">heading: <span className="text-amber-300">{heading}°</span></div>
          {!hasOrientation && (
            <div className="text-rose-300 text-[10px] mt-1">no orientation events received yet</div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onRecalibrate}
        className="absolute right-4 pointer-events-auto bg-slate-950/70 backdrop-blur border border-slate-800 hover:border-amber-500/40 rounded-lg px-3 py-2 text-amber-200"
        style={{ top: topInset }}
        title="Set current facing direction as the world's 'forward'"
      >
        recalibrate ↻
      </button>

      <div
        className="absolute left-1/2 -translate-x-1/2 text-[10px] text-slate-300 bg-slate-950/60 backdrop-blur border border-slate-800 rounded-lg px-3 py-1.5 text-center"
        style={{ bottom: bottomInset }}
      >
        turn your phone to look around · walk a step or two to lean toward a wall
      </div>
    </div>
  );
}
