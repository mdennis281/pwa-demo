import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getCharacter, type CharacterVariant } from './characters';

type Props = {
  variant: number;
  /** Stride animation phase 0..1+ (advances faster when running) */
  state?: 'idle' | 'run' | 'air';
};

export default function Character({ variant, state = 'idle' }: Props) {
  const c = getCharacter(variant);
  const groupRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Mesh>(null);
  const armRRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(0);

  useFrame((_, dt) => {
    const speed = state === 'run' ? 8 : state === 'air' ? 0 : 1.4;
    tRef.current += dt * speed;
    const t = tRef.current;
    const bob = state === 'run' ? Math.sin(t * 2) * 0.08 : Math.sin(t) * 0.04;
    if (groupRef.current) groupRef.current.position.y = bob;
    const swing = state === 'run' ? Math.sin(t * 2) * 0.7 : state === 'air' ? -0.6 : Math.sin(t) * 0.1;
    if (armLRef.current) armLRef.current.rotation.x = swing;
    if (armRRef.current) armRRef.current.rotation.x = -swing;
  });

  return (
    <group ref={groupRef}>
      <Body c={c} />
      <Head c={c} />
      <Accessory c={c} />
      <mesh ref={armLRef} position={[-0.55, 0.4, 0]}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color={c.headColor} />
      </mesh>
      <mesh ref={armRRef} position={[0.55, 0.4, 0]}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color={c.headColor} />
      </mesh>
    </group>
  );
}

function Body({ c }: { c: CharacterVariant }) {
  const color = c.bodyColor;
  switch (c.body) {
    case 'capsule':
      return (
        <mesh position={[0, 0.5, 0]} castShadow>
          <capsuleGeometry args={[0.36, 0.8, 6, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
    case 'cube':
      return (
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1.0, 0.8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
    case 'sphere':
      return (
        <mesh position={[0, 0.55, 0]} castShadow>
          <sphereGeometry args={[0.55, 24, 24]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
    case 'cylinder':
      return (
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 1.0, 18]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
    case 'box-tall':
      return (
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.6, 1.2, 0.6]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
  }
}

function Head({ c }: { c: CharacterVariant }) {
  switch (c.head) {
    case 'sphere':
      return (
        <mesh position={[0, 1.25, 0]} castShadow>
          <sphereGeometry args={[0.32, 20, 20]} />
          <meshStandardMaterial color={c.headColor} />
          <EyePair offset={[0.13, 0, 0.3]} />
        </mesh>
      );
    case 'cube':
      return (
        <mesh position={[0, 1.25, 0]} castShadow>
          <boxGeometry args={[0.55, 0.55, 0.55]} />
          <meshStandardMaterial color={c.headColor} />
          <EyePair offset={[0.15, 0, 0.28]} />
        </mesh>
      );
    case 'cone':
      return (
        <mesh position={[0, 1.3, 0]} castShadow>
          <coneGeometry args={[0.35, 0.7, 18]} />
          <meshStandardMaterial color={c.headColor} />
        </mesh>
      );
  }
}

function EyePair({ offset }: { offset: [number, number, number] }) {
  const [ox, oy, oz] = offset;
  return (
    <>
      <mesh position={[ox, oy, oz]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[-ox, oy, oz]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </>
  );
}

function Accessory({ c }: { c: CharacterVariant }) {
  switch (c.accessory) {
    case 'top-hat':
      return (
        <group position={[0, 1.6, 0]}>
          <mesh>
            <cylinderGeometry args={[0.28, 0.28, 0.4, 18]} />
            <meshStandardMaterial color={c.accessoryColor} />
          </mesh>
          <mesh position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.4, 0.4, 0.04, 18]} />
            <meshStandardMaterial color={c.accessoryColor} />
          </mesh>
        </group>
      );
    case 'antenna':
      return (
        <group position={[0, 1.45, 0]}>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshStandardMaterial color={c.accessoryColor} emissive={c.accessoryColor} emissiveIntensity={0.6} />
          </mesh>
        </group>
      );
    case 'horns':
      return (
        <group position={[0, 1.5, 0]}>
          <mesh position={[-0.15, 0.05, 0]} rotation={[0, 0, -0.4]}>
            <coneGeometry args={[0.07, 0.3, 10]} />
            <meshStandardMaterial color={c.accessoryColor} />
          </mesh>
          <mesh position={[0.15, 0.05, 0]} rotation={[0, 0, 0.4]}>
            <coneGeometry args={[0.07, 0.3, 10]} />
            <meshStandardMaterial color={c.accessoryColor} />
          </mesh>
        </group>
      );
    case 'cap':
      return (
        <group position={[0, 1.55, 0]}>
          <mesh>
            <sphereGeometry args={[0.34, 18, 18, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
            <meshStandardMaterial color={c.accessoryColor} />
          </mesh>
          <mesh position={[0, -0.02, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.22, 0.03, 18, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={c.accessoryColor} />
          </mesh>
        </group>
      );
    case 'none':
      return null;
  }
}
