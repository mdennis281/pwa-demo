import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import Player from './Player';
import RemotePlayer from './RemotePlayer';
import Spectator from './Spectator';
import World, { generateWorld } from './World';
import { spawnFor } from './worldgen';
import HUD from './HUD';
import TouchControls from './controls/TouchControls';
import { useKeyboard } from './controls/useKeyboard';
import { useMouseLook } from './controls/useMouseLook';
import { input } from './controls/input';
import type { GameSnapshot, LocalInput, LobbyState, Role } from '@pwa-demo/shared';
import { getSocket } from '../lib/socket';

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
  const myStateRef = useRef({ y: spawn.y, maxY: spawn.y });

  useKeyboard(true);
  const { locked } = useMouseLook(canvasEl, !isTouch);

  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    const s = getSocket();
    const onSnap = (snap: GameSnapshot) => {
      if (snap.lobbyId === lobby.id) setSnapshot(snap);
    };
    s.on('game:snapshot', onSnap);
    return () => { s.off('game:snapshot', onSnap); };
  }, [lobby.id]);

  const sendInput = (i: LocalInput) => {
    getSocket().emit('game:input', i);
    myStateRef.current.y = i.y;
    if (i.y > myStateRef.current.maxY) myStateRef.current.maxY = i.y;
  };

  const others = snapshot?.players.filter((p) => p.id !== selfId && p.role === 'player') ?? [];
  const mySnap = snapshot?.players.find((p) => p.id === selfId);
  const myMaxHeight = Math.max(mySnap?.maxHeight ?? 0, myStateRef.current.maxY);

  return (
    <div className="fixed inset-0 bg-slate-950 z-40">
      <Canvas
        shadows
        camera={{ position: [10, 6, 10], fov: 65, near: 0.1, far: 5000 }}
        onCreated={({ gl }) => setCanvasEl(gl.domElement)}
      >
        <Suspense fallback={null}>
          {/* Hard background color so even if Sky doesn't render, the horizon is sky-blue */}
          <color attach="background" args={['#7fb6e8']} />
          {/* Light far-distance fog only — keeps the sky and far clouds visible */}
          <fog attach="fog" args={['#bcdcf2', 180, 600]} />
          {/* Drei Sky: golden-hour-ish, more dramatic params */}
          <Sky
            sunPosition={[15, 8, 30]}
            turbidity={8}
            rayleigh={3.2}
            mieCoefficient={0.005}
            mieDirectionalG={0.8}
            distance={1000}
          />
          <hemisphereLight args={['#fef3c7', '#475569', 0.55]} />
          <ambientLight intensity={0.18} color="#fde68a" />
          <directionalLight
            position={[30, 50, 18]}
            intensity={1.4}
            color="#fde68a"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={50}
            shadow-camera-bottom={-30}
            shadow-camera-near={1}
            shadow-camera-far={180}
            shadow-bias={-0.0002}
          />
          <World data={world} />
          {role === 'player' ? (
            <Player
              variant={variant}
              boxes={world.boxes}
              spawn={spawn}
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
      />

      <TouchControls active={isTouch} />

      <div className="absolute top-4 right-1/2 translate-x-1/2 z-30 flex gap-2">
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
