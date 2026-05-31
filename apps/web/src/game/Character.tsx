import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getCharacter, type CharacterVariant, type Quirk } from './characters';

type State = 'idle' | 'run' | 'air';

type Props = {
  variant: number;
  state?: State;
};

// ─── shared global easter-egg signals ──────────────────────────────────────
// Singletons so every Character (yours + remote players visible to you)
// reacts in unison. Listeners attach lazily on first Character mount.
const ee = {
  partyUntil: -Infinity,    // performance.now() target — dance while < this
  partyOn: false,           // toggled by 'P'
  waveUntil: -Infinity,     // when set, everyone waves for ~1.6s
  installed: false,
};

/** Trigger the everyone-waves animation directly (used by the summit
 *  celebration), without faking a keyboard event. */
export function triggerWave(durationMs = 1600) {
  ee.waveUntil = performance.now() + durationMs;
}

function installGlobalEgg() {
  if (ee.installed || typeof window === 'undefined') return;
  ee.installed = true;
  window.addEventListener('keydown', (e) => {
    // ignore when typing in inputs
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
    if (e.repeat) return;
    if (e.key === 'h' || e.key === 'H') {
      ee.waveUntil = performance.now() + 1600;
    } else if (e.key === 'p' || e.key === 'P') {
      ee.partyOn = !ee.partyOn;
      ee.partyUntil = ee.partyOn ? Number.POSITIVE_INFINITY : -Infinity;
    }
  });
}

export default function Character({ variant, state = 'idle' }: Props) {
  useEffect(installGlobalEgg, []);
  const c = getCharacter(variant);

  // Stable per-instance phase offsets so 8 characters don't move in lockstep.
  const seed = useMemo(() => Math.random() * 1000, []);

  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);

  // Limb pivots
  const armLHip = useRef<THREE.Group>(null);
  const armRHip = useRef<THREE.Group>(null);
  const armLElbow = useRef<THREE.Group>(null);
  const armRElbow = useRef<THREE.Group>(null);
  const legLHip = useRef<THREE.Group>(null);
  const legRHip = useRef<THREE.Group>(null);
  const legLKnee = useRef<THREE.Group>(null);
  const legRKnee = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  // Eyes (for blink)
  const eyeLRef = useRef<THREE.Mesh>(null);
  const eyeRRef = useRef<THREE.Mesh>(null);

  // Antenna bulb (for Sparky pulse + Glitchy)
  const antennaRef = useRef<THREE.MeshStandardMaterial>(null);

  // Animation state
  const tRef = useRef(seed);
  const prevStateRef = useRef<State>(state);
  const landAtRef = useRef(-Infinity);   // for squash-on-landing
  const nextQuirkAtRef = useRef(0);
  const quirkUntilRef = useRef(0);
  const blinkUntilRef = useRef(0);
  const nextBlinkAtRef = useRef(0);

  useFrame((_, dt) => {
    const cdt = Math.min(dt, 0.05);
    // step speed is what drives the stride; bigger when running
    const stepSpeed = state === 'run' ? 9 : state === 'air' ? 0 : 1.6;
    tRef.current += cdt * stepSpeed;
    const t = tRef.current;
    const nowMs = performance.now();

    // Landing squash: detect air → ground transition
    if (prevStateRef.current === 'air' && state !== 'air') {
      landAtRef.current = nowMs;
    }
    prevStateRef.current = state;

    // ─── root bob + squash/stretch ───────────────────────────────────────
    const breathing = Math.sin((nowMs / 1000) * 1.8 + seed) * 0.012;
    const bob =
      state === 'run' ? Math.abs(Math.sin(t)) * 0.06 :
      state === 'air' ? 0 :
      breathing;

    let sx = 1, sy = 1, sz = 1;
    if (state === 'air') {
      sy = 1.06; sx = sz = 0.97;
    } else {
      const sinceLand = nowMs - landAtRef.current;
      if (sinceLand < 220) {
        const k = 1 - sinceLand / 220;
        const squash = 0.3 * k;
        sy = 1 - squash;
        sx = sz = 1 + squash * 0.55;
      }
    }

    if (rootRef.current) {
      rootRef.current.position.y = bob;
      rootRef.current.scale.set(sx, sy, sz);
    }

    // ─── arm/leg cycle ───────────────────────────────────────────────────
    if (state === 'run') {
      const swing = Math.sin(t) * 0.95;
      const shinL = Math.max(0, -Math.sin(t)) * 1.35;
      const shinR = Math.max(0, Math.sin(t)) * 1.35;
      if (legLHip.current) legLHip.current.rotation.x = swing * 0.65;
      if (legRHip.current) legRHip.current.rotation.x = -swing * 0.65;
      if (legLKnee.current) legLKnee.current.rotation.x = -shinL;
      if (legRKnee.current) legRKnee.current.rotation.x = -shinR;
      // arms swing opposite to legs, with slight elbow bend
      if (armLHip.current) armLHip.current.rotation.x = -swing * 0.85;
      if (armRHip.current) armRHip.current.rotation.x = swing * 0.85;
      const elbowL = Math.max(0, Math.sin(t)) * 0.6 + 0.3;
      const elbowR = Math.max(0, -Math.sin(t)) * 0.6 + 0.3;
      if (armLElbow.current) armLElbow.current.rotation.x = -elbowL;
      if (armRElbow.current) armRElbow.current.rotation.x = -elbowR;
      if (bodyRef.current) {
        bodyRef.current.rotation.z = Math.sin(t) * 0.05;
        bodyRef.current.rotation.x = 0.08;
      }
    } else if (state === 'air') {
      // Tucked: knees up, arms slightly back
      if (legLHip.current) legLHip.current.rotation.x = -0.55;
      if (legRHip.current) legRHip.current.rotation.x = -0.55;
      if (legLKnee.current) legLKnee.current.rotation.x = -1.1;
      if (legRKnee.current) legRKnee.current.rotation.x = -1.1;
      if (armLHip.current) armLHip.current.rotation.x = -0.7;
      if (armRHip.current) armRHip.current.rotation.x = -0.7;
      if (armLElbow.current) armLElbow.current.rotation.x = -0.5;
      if (armRElbow.current) armRElbow.current.rotation.x = -0.5;
      if (bodyRef.current) {
        bodyRef.current.rotation.z = 0;
        bodyRef.current.rotation.x = 0.05;
      }
    } else {
      // idle: gentle breathing sway, slight knee softening
      const ts = nowMs / 1000;
      const sway = Math.sin(ts * 0.9 + seed) * 0.06;
      if (legLHip.current) legLHip.current.rotation.x = sway * 0.5;
      if (legRHip.current) legRHip.current.rotation.x = -sway * 0.5;
      if (legLKnee.current) legLKnee.current.rotation.x = -0.12;
      if (legRKnee.current) legRKnee.current.rotation.x = -0.12;
      if (armLHip.current) armLHip.current.rotation.x = -sway * 0.4;
      if (armRHip.current) armRHip.current.rotation.x = sway * 0.4;
      // Hands rest slightly inward
      if (armLElbow.current) armLElbow.current.rotation.x = -0.15;
      if (armRElbow.current) armRElbow.current.rotation.x = -0.15;
      if (bodyRef.current) {
        bodyRef.current.rotation.z = 0;
        bodyRef.current.rotation.x = 0;
      }
    }

    // ─── head: subtle look-around in idle, level in motion ───────────────
    if (headRef.current) {
      if (state === 'idle') {
        headRef.current.rotation.y = Math.sin(nowMs / 1300 + seed) * 0.2;
        headRef.current.rotation.x = Math.sin(nowMs / 1700 + seed) * 0.06;
      } else {
        headRef.current.rotation.y = 0;
        headRef.current.rotation.x = state === 'run' ? -0.05 : 0;
      }
    }

    // ─── eye blink ───────────────────────────────────────────────────────
    if (nowMs > nextBlinkAtRef.current) {
      blinkUntilRef.current = nowMs + 110;
      nextBlinkAtRef.current = nowMs + 2400 + Math.random() * 3600;
    }
    const blinking = nowMs < blinkUntilRef.current;
    const eyeY = blinking ? 0.18 : 1;
    if (eyeLRef.current) eyeLRef.current.scale.y = eyeY;
    if (eyeRRef.current) eyeRRef.current.scale.y = eyeY;

    // ─── per-variant idle quirk (only fires when idle) ───────────────────
    if (state === 'idle' && nowMs > nextQuirkAtRef.current) {
      quirkUntilRef.current = nowMs + 1100;
      nextQuirkAtRef.current = nowMs + 5000 + Math.random() * 7000;
    }
    const quirkActive = nowMs < quirkUntilRef.current && state === 'idle';
    const quirkPhase = quirkActive
      ? 1 - (quirkUntilRef.current - nowMs) / 1100
      : 0;
    applyQuirk(c.quirk, quirkPhase, quirkActive, {
      head: headRef.current,
      body: bodyRef.current,
      root: rootRef.current,
      antennaMat: antennaRef.current,
    });

    // ─── ensemble easter eggs (overlaid on top) ──────────────────────────
    // Wave: both arms shoot up + wiggle
    const waveLeft = ee.waveUntil - nowMs;
    if (waveLeft > 0) {
      const w = Math.min(1, waveLeft / 200) * Math.min(1, (1600 - waveLeft) / 200);
      const wiggle = Math.sin(nowMs / 90) * 0.35 * w;
      if (armLHip.current) armLHip.current.rotation.x = -2.4 * w;
      if (armRHip.current) armRHip.current.rotation.x = -2.4 * w;
      if (armLHip.current) armLHip.current.rotation.z = 0.4 * w + wiggle;
      if (armRHip.current) armRHip.current.rotation.z = -0.4 * w - wiggle;
      if (armLElbow.current) armLElbow.current.rotation.x = -0.4 * w;
      if (armRElbow.current) armRElbow.current.rotation.x = -0.4 * w;
    } else {
      if (armLHip.current) armLHip.current.rotation.z = 0;
      if (armRHip.current) armRHip.current.rotation.z = 0;
    }

    // Party dance: everyone jiggles + spins shoulders
    if (ee.partyOn) {
      const p = nowMs / 220;
      const bounce = Math.abs(Math.sin(p)) * 0.2;
      if (rootRef.current) rootRef.current.position.y = bob + bounce;
      if (bodyRef.current) {
        bodyRef.current.rotation.y = Math.sin(p * 0.5) * 0.5;
        bodyRef.current.rotation.z = Math.sin(p) * 0.18;
      }
      const armSwing = Math.sin(p) * 1.4;
      if (armLHip.current) armLHip.current.rotation.x = -1.0 + armSwing;
      if (armRHip.current) armRHip.current.rotation.x = -1.0 - armSwing;
      if (armLHip.current) armLHip.current.rotation.z = 0.6;
      if (armRHip.current) armRHip.current.rotation.z = -0.6;
      const kneeBend = 0.3 + Math.abs(Math.sin(p)) * 0.6;
      if (legLHip.current) legLHip.current.rotation.x = Math.sin(p + 0.5) * 0.2;
      if (legRHip.current) legRHip.current.rotation.x = -Math.sin(p + 0.5) * 0.2;
      if (legLKnee.current) legLKnee.current.rotation.x = -kneeBend;
      if (legRKnee.current) legRKnee.current.rotation.x = -kneeBend;
    }
  });

  return (
    <group ref={rootRef}>
      <group ref={bodyRef}>
        <Body c={c} />
        <Legs
          c={c}
          refs={{ legLHip, legRHip, legLKnee, legRKnee }}
        />
        <group ref={headRef}>
          <Head c={c} eyeLRef={eyeLRef} eyeRRef={eyeRRef} />
          <Accessory c={c} antennaRef={antennaRef} />
        </group>
        <Arms
          c={c}
          refs={{ armLHip, armRHip, armLElbow, armRElbow }}
        />
      </group>
    </group>
  );
}

// ─── parts ────────────────────────────────────────────────────────────────

const HIP_Y = 0.78;        // pivot height for legs (above feet)
const SHOULDER_Y = 1.32;   // pivot for arms

// ─── shared geometry + material caches ──────────────────────────────────────
// Avatars used to inline ~26 <geometry>/<material> elements each, so every
// Character that mounted allocated ~26 BufferGeometries + materials and uploaded
// them in a single frame — a visible hitch on join, and steady GC churn as
// players come and go. These caches build each distinct shape/material ONCE and
// share them across all avatars, so mounting a player allocates ~nothing. Meshes
// using shared resources set `dispose={null}` so React-three-fiber never frees a
// singleton out from under the other avatars on unmount. (The antenna bulb is
// animated per-instance, so it keeps its own geometry + material.)
const _geoCache = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = _geoCache.get(key);
  if (!g) { g = make(); _geoCache.set(key, g); }
  return g;
}

type MatOpts = { color: string; roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number; side?: THREE.Side };
const _matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(o: MatOpts): THREE.MeshStandardMaterial {
  const key = `${o.color}|${o.roughness ?? 1}|${o.metalness ?? 0}|${o.emissive ?? '#000000'}|${o.emissiveIntensity ?? 0}|${o.side ?? 0}`;
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: o.color,
      roughness: o.roughness ?? 1,
      metalness: o.metalness ?? 0,
      emissive: o.emissive ?? '#000000',
      emissiveIntensity: o.emissiveIntensity ?? 0,
      side: o.side ?? THREE.FrontSide,
    });
    _matCache.set(key, m);
  }
  return m;
}

function Body({ c }: { c: CharacterVariant }) {
  const color = c.bodyColor;
  switch (c.body) {
    case 'capsule':
      return (
        <mesh position={[0, 1.05, 0]} castShadow dispose={null}
          geometry={geo('body-cap', () => new THREE.CapsuleGeometry(0.36, 0.7, 12, 24))}
          material={mat({ color, roughness: 0.55, metalness: 0.05 })}
        />
      );
    case 'cube':
      return (
        <mesh position={[0, 1.05, 0]} castShadow dispose={null}
          geometry={geo('body-cube', () => new THREE.BoxGeometry(0.78, 0.86, 0.66))}
          material={mat({ color, roughness: 0.6 })}
        />
      );
    case 'sphere':
      return (
        <mesh position={[0, 1.1, 0]} castShadow dispose={null}
          geometry={geo('body-sphere', () => new THREE.SphereGeometry(0.5, 32, 32))}
          material={mat({ color, roughness: 0.45 })}
        />
      );
    case 'cylinder':
      return (
        <mesh position={[0, 1.05, 0]} castShadow dispose={null}
          geometry={geo('body-cyl', () => new THREE.CylinderGeometry(0.4, 0.42, 0.88, 32))}
          material={mat({ color, roughness: 0.55 })}
        />
      );
    case 'box-tall':
      return (
        <mesh position={[0, 1.15, 0]} castShadow dispose={null}
          geometry={geo('body-boxtall', () => new THREE.BoxGeometry(0.58, 1.05, 0.5))}
          material={mat({ color, roughness: 0.5 })}
        />
      );
  }
}

function Head({
  c,
  eyeLRef,
  eyeRRef,
}: {
  c: CharacterVariant;
  eyeLRef: React.RefObject<THREE.Mesh | null>;
  eyeRRef: React.RefObject<THREE.Mesh | null>;
}) {
  // Per-shape head transform; eyes and mouth sit on the +Z face.
  switch (c.head) {
    case 'sphere':
      return (
        <group position={[0, 1.85, 0]}>
          <mesh castShadow dispose={null}
            geometry={geo('head-sphere', () => new THREE.SphereGeometry(0.32, 32, 32))}
            material={mat({ color: c.headColor, roughness: 0.5 })}
          />
          <Face faceZ={0.3} eyeSpread={0.13} eyeY={0.03} mouth={c.mouth} eyeLRef={eyeLRef} eyeRRef={eyeRRef} />
        </group>
      );
    case 'cube':
      return (
        <group position={[0, 1.85, 0]}>
          <mesh castShadow dispose={null}
            geometry={geo('head-cube', () => new THREE.BoxGeometry(0.56, 0.56, 0.52))}
            material={mat({ color: c.headColor, roughness: 0.55 })}
          />
          <Face faceZ={0.27} eyeSpread={0.15} eyeY={0.04} mouth={c.mouth} eyeLRef={eyeLRef} eyeRRef={eyeRRef} />
        </group>
      );
    case 'cone':
      return (
        <group position={[0, 2.0, 0]}>
          <mesh castShadow dispose={null}
            geometry={geo('head-cone', () => new THREE.ConeGeometry(0.36, 0.78, 24))}
            material={mat({ color: c.headColor, roughness: 0.5 })}
          />
          {/* face wraps lower on the cone */}
          <Face faceZ={0.28} faceY={-0.18} eyeSpread={0.1} eyeY={0.0} mouth={c.mouth} eyeLRef={eyeLRef} eyeRRef={eyeRRef} small />
        </group>
      );
  }
}

function Face({
  faceZ,
  faceY = 0,
  eyeSpread,
  eyeY,
  mouth,
  eyeLRef,
  eyeRRef,
  small = false,
}: {
  faceZ: number;
  faceY?: number;
  eyeSpread: number;
  eyeY: number;
  mouth: CharacterVariant['mouth'];
  eyeLRef: React.RefObject<THREE.Mesh | null>;
  eyeRRef: React.RefObject<THREE.Mesh | null>;
  small?: boolean;
}) {
  const eyeR = small ? 0.045 : 0.06;
  const eyeGeo = geo(`eye-${eyeR}`, () => new THREE.SphereGeometry(eyeR, 14, 14));
  const shineGeo = geo(`eyeshine-${eyeR}`, () => new THREE.SphereGeometry(eyeR * 0.35, 8, 8));
  const eyeMat = mat({ color: '#0f172a' });
  const shineMat = mat({ color: '#f8fafc' });
  return (
    <group position={[0, faceY, 0]}>
      <mesh ref={eyeLRef} position={[-eyeSpread, eyeY, faceZ]} dispose={null} geometry={eyeGeo} material={eyeMat} />
      <mesh ref={eyeRRef} position={[eyeSpread, eyeY, faceZ]} dispose={null} geometry={eyeGeo} material={eyeMat} />
      {/* tiny eye-shine */}
      <mesh position={[-eyeSpread + eyeR * 0.4, eyeY + eyeR * 0.4, faceZ + eyeR * 0.7]} dispose={null} geometry={shineGeo} material={shineMat} />
      <mesh position={[eyeSpread + eyeR * 0.4, eyeY + eyeR * 0.4, faceZ + eyeR * 0.7]} dispose={null} geometry={shineGeo} material={shineMat} />
      <Mouth shape={mouth} z={faceZ} y={eyeY - (small ? 0.08 : 0.11)} />
    </group>
  );
}

function Mouth({
  shape,
  z,
  y,
}: {
  shape: CharacterVariant['mouth'];
  z: number;
  y: number;
}) {
  const m = mat({ color: '#0f172a' });
  switch (shape) {
    case 'smile':
      // half-torus arc, opening UP → smile
      return (
        <mesh position={[0, y, z]} rotation={[0, 0, Math.PI]} dispose={null}
          geometry={geo('mouth-smile', () => new THREE.TorusGeometry(0.075, 0.012, 6, 12, Math.PI))}
          material={m}
        />
      );
    case 'grin':
      return (
        <mesh position={[0, y, z]} rotation={[0, 0, Math.PI]} dispose={null}
          geometry={geo('mouth-grin', () => new THREE.TorusGeometry(0.09, 0.014, 6, 14, Math.PI))}
          material={m}
        />
      );
    case 'smirk':
      // half arc but tilted
      return (
        <mesh position={[0.02, y, z]} rotation={[0, 0, Math.PI + 0.35]} dispose={null}
          geometry={geo('mouth-smirk', () => new THREE.TorusGeometry(0.07, 0.011, 6, 10, Math.PI * 0.7))}
          material={m}
        />
      );
    case 'oh':
      return (
        <mesh position={[0, y + 0.005, z]} dispose={null}
          geometry={geo('mouth-oh', () => new THREE.TorusGeometry(0.03, 0.012, 6, 14))}
          material={m}
        />
      );
    case 'none':
    default:
      return null;
  }
}

function Arms({
  c,
  refs,
}: {
  c: CharacterVariant;
  refs: {
    armLHip: React.RefObject<THREE.Group | null>;
    armRHip: React.RefObject<THREE.Group | null>;
    armLElbow: React.RefObject<THREE.Group | null>;
    armRElbow: React.RefObject<THREE.Group | null>;
  };
}) {
  // Shoulder offset depends on body shape — wider for cubes/spheres.
  const xOff =
    c.body === 'cube' || c.body === 'sphere' ? 0.5 :
    c.body === 'box-tall' ? 0.42 :
    c.body === 'cylinder' ? 0.46 :
    0.44; // capsule
  return (
    <>
      <Limb
        side="left"
        x={-xOff}
        y={SHOULDER_Y}
        hipRef={refs.armLHip}
        kneeRef={refs.armLElbow}
        skinColor={c.headColor}
        sleeveColor={c.bodyColor}
        upperLen={0.36}
        lowerLen={0.32}
        radius={0.085}
        terminalKind="hand"
      />
      <Limb
        side="right"
        x={xOff}
        y={SHOULDER_Y}
        hipRef={refs.armRHip}
        kneeRef={refs.armRElbow}
        skinColor={c.headColor}
        sleeveColor={c.bodyColor}
        upperLen={0.36}
        lowerLen={0.32}
        radius={0.085}
        terminalKind="hand"
      />
    </>
  );
}

function Legs({
  c,
  refs,
}: {
  c: CharacterVariant;
  refs: {
    legLHip: React.RefObject<THREE.Group | null>;
    legRHip: React.RefObject<THREE.Group | null>;
    legLKnee: React.RefObject<THREE.Group | null>;
    legRKnee: React.RefObject<THREE.Group | null>;
  };
}) {
  return (
    <>
      <Limb
        side="left"
        x={-0.16}
        y={HIP_Y}
        hipRef={refs.legLHip}
        kneeRef={refs.legLKnee}
        skinColor={c.legColor}
        sleeveColor={c.legColor}
        upperLen={0.4}
        lowerLen={0.35}
        radius={0.105}
        terminalKind="foot"
      />
      <Limb
        side="right"
        x={0.16}
        y={HIP_Y}
        hipRef={refs.legRHip}
        kneeRef={refs.legRKnee}
        skinColor={c.legColor}
        sleeveColor={c.legColor}
        upperLen={0.4}
        lowerLen={0.35}
        radius={0.105}
        terminalKind="foot"
      />
    </>
  );
}

/** Two-segment limb that pivots at hip and at knee. Used for arms and legs.
 *  Geometry hangs DOWN from the hip pivot; rotating the hip group forward
 *  swings the whole leg/arm; rotating the knee group bends the lower segment. */
function Limb({
  x,
  y,
  hipRef,
  kneeRef,
  skinColor,
  sleeveColor,
  upperLen,
  lowerLen,
  radius,
  terminalKind,
}: {
  side: 'left' | 'right';
  x: number;
  y: number;
  hipRef: React.RefObject<THREE.Group | null>;
  kneeRef: React.RefObject<THREE.Group | null>;
  skinColor: string;
  sleeveColor: string;
  upperLen: number;
  lowerLen: number;
  radius: number;
  terminalKind: 'hand' | 'foot';
}) {
  const sleeveMat = mat({ color: sleeveColor, roughness: 0.55 });
  const skinMat = mat({ color: skinColor, roughness: 0.55 });
  return (
    <group ref={hipRef} position={[x, y, 0]}>
      {/* upper segment, centered below pivot */}
      <mesh position={[0, -upperLen / 2, 0]} castShadow dispose={null}
        geometry={geo(`limb-up-${radius}-${upperLen}`, () => new THREE.CylinderGeometry(radius * 0.9, radius, upperLen, 16))}
        material={sleeveMat}
      />
      {/* knee joint sphere */}
      <mesh position={[0, -upperLen, 0]} castShadow dispose={null}
        geometry={geo(`limb-knee-${radius}`, () => new THREE.SphereGeometry(radius * 0.95, 12, 12))}
        material={sleeveMat}
      />
      <group ref={kneeRef} position={[0, -upperLen, 0]}>
        {/* lower segment */}
        <mesh position={[0, -lowerLen / 2, 0]} castShadow dispose={null}
          geometry={geo(`limb-lo-${radius}-${lowerLen}`, () => new THREE.CylinderGeometry(radius * 0.85, radius * 0.9, lowerLen, 16))}
          material={skinMat}
        />
        {terminalKind === 'foot' ? (
          <mesh position={[0, -lowerLen - 0.04, 0.06]} castShadow dispose={null}
            geometry={geo(`foot-${radius}`, () => new THREE.BoxGeometry(radius * 1.9, 0.09, radius * 2.6))}
            material={mat({ color: '#1e293b', roughness: 0.7 })}
          />
        ) : (
          <mesh position={[0, -lowerLen - radius * 0.6, 0]} castShadow dispose={null}
            geometry={geo(`hand-${radius}`, () => new THREE.SphereGeometry(radius * 1.05, 14, 14))}
            material={skinMat}
          />
        )}
      </group>
    </group>
  );
}

function Accessory({
  c,
  antennaRef,
}: {
  c: CharacterVariant;
  antennaRef: React.RefObject<THREE.MeshStandardMaterial | null>;
}) {
  // Position offsets account for the new (higher) head positions.
  const headTopY =
    c.head === 'sphere' ? 2.15 :
    c.head === 'cube' ? 2.13 :
    /* cone */ 2.40;

  switch (c.accessory) {
    case 'top-hat':
      return (
        <group position={[0, headTopY - 0.04, 0]}>
          <mesh castShadow dispose={null}
            geometry={geo('hat-crown', () => new THREE.CylinderGeometry(0.26, 0.26, 0.36, 24))}
            material={mat({ color: c.accessoryColor, roughness: 0.4 })}
          />
          <mesh position={[0, -0.2, 0]} castShadow dispose={null}
            geometry={geo('hat-brim', () => new THREE.CylinderGeometry(0.4, 0.4, 0.04, 24))}
            material={mat({ color: c.accessoryColor, roughness: 0.4 })}
          />
          <mesh position={[0, -0.16, 0.001]} dispose={null}
            geometry={geo('hat-ring', () => new THREE.RingGeometry(0.26, 0.32, 24))}
            material={mat({ color: '#facc15', emissive: '#facc15', emissiveIntensity: 0.2, side: THREE.DoubleSide })}
          />
        </group>
      );
    case 'antenna':
      return (
        <group position={[0, headTopY - 0.05, 0]}>
          <mesh position={[0, 0.22, 0]} castShadow dispose={null}
            geometry={geo('ant-stalk', () => new THREE.CylinderGeometry(0.022, 0.022, 0.4, 10))}
            material={mat({ color: '#94a3b8' })}
          />
          {/* bulb material is animated (Sparky pulse), so this mesh keeps its own
              geometry + material and disposes normally on unmount */}
          <mesh position={[0, 0.48, 0]} castShadow>
            <sphereGeometry args={[0.085, 16, 16]} />
            <meshStandardMaterial
              ref={antennaRef}
              color={c.accessoryColor}
              emissive={c.accessoryColor}
              emissiveIntensity={0.7}
            />
          </mesh>
        </group>
      );
    case 'horns': {
      const hornGeo = geo('horn', () => new THREE.ConeGeometry(0.075, 0.32, 14));
      const hornMat = mat({ color: c.accessoryColor, roughness: 0.5 });
      return (
        <group position={[0, headTopY - 0.08, 0]}>
          <mesh position={[-0.16, 0.08, 0]} rotation={[0, 0, -0.45]} castShadow dispose={null} geometry={hornGeo} material={hornMat} />
          <mesh position={[0.16, 0.08, 0]} rotation={[0, 0, 0.45]} castShadow dispose={null} geometry={hornGeo} material={hornMat} />
        </group>
      );
    }
    case 'cap': {
      const capMat = mat({ color: c.accessoryColor, roughness: 0.5 });
      return (
        <group position={[0, headTopY - 0.1, 0]}>
          <mesh castShadow dispose={null}
            geometry={geo('cap-dome', () => new THREE.SphereGeometry(0.34, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2.4))}
            material={capMat}
          />
          <mesh position={[0, -0.02, 0.28]} rotation={[Math.PI / 2, 0, 0]} castShadow dispose={null}
            geometry={geo('cap-brim', () => new THREE.CylinderGeometry(0.16, 0.22, 0.03, 24, 1, false, 0, Math.PI))}
            material={capMat}
          />
          {/* button on top */}
          <mesh position={[0, 0.18, 0]} castShadow dispose={null}
            geometry={geo('cap-button', () => new THREE.SphereGeometry(0.04, 10, 10))}
            material={mat({ color: '#f8fafc' })}
          />
        </group>
      );
    }
    case 'none':
      return null;
  }
}

/** Apply a per-variant quirk on top of the base pose. `phase` runs 0..1 over
 *  the quirk's duration. When inactive, resets any quirk-only properties. */
function applyQuirk(
  q: Quirk,
  phase: number,
  active: boolean,
  refs: {
    head: THREE.Group | null;
    body: THREE.Group | null;
    root: THREE.Group | null;
    antennaMat: THREE.MeshStandardMaterial | null;
  },
) {
  // Default resets — clear quirk-only state every frame; the base anim writes
  // its own pose, and we only stomp specific channels when active.
  if (refs.antennaMat) refs.antennaMat.emissiveIntensity = 0.7;
  if (!active) return;

  const p = Math.sin(phase * Math.PI); // 0→1→0 over the quirk window

  switch (q) {
    case 'antenna-pulse':
      if (refs.antennaMat) refs.antennaMat.emissiveIntensity = 0.7 + p * 2.0;
      if (refs.head) refs.head.position.y = p * 0.03;
      break;
    case 'tip-hat':
      if (refs.head) {
        refs.head.rotation.x = -p * 0.4;
        refs.head.position.y = p * 0.05;
      }
      break;
    case 'twirl':
      if (refs.root) refs.root.rotation.y = phase * Math.PI * 2;
      break;
    case 'tip-wobble':
      if (refs.head) {
        refs.head.rotation.z = Math.sin(phase * Math.PI * 6) * 0.25 * p;
      }
      break;
    case 'head-shake':
      if (refs.head) refs.head.rotation.y = Math.sin(phase * Math.PI * 4) * 0.4 * p;
      break;
    case 'glitch-step':
      if (refs.root) {
        const step = Math.sin(phase * Math.PI * 8) > 0.4 ? 0.15 : -0.15;
        refs.root.position.x = step * p;
      }
      break;
    case 'roll-side':
      if (refs.body) refs.body.rotation.z = Math.sin(phase * Math.PI * 2) * 0.3 * p;
      break;
    case 'nod':
      if (refs.head) refs.head.rotation.x = Math.sin(phase * Math.PI * 4) * 0.35 * p;
      break;
  }
}
