import { useEffect, useState } from 'react';
import LobbyList from '../game/lobby/LobbyList';
import GameCanvas from '../game/GameCanvas';
import { getSocket } from '../lib/socket';
import type { LobbyState, Role } from '@pwa-demo/shared';

type EnteredLobby = {
  lobby: LobbyState;
  role: Role;
  character: number;
};

export default function Game() {
  const [entered, setEntered] = useState<EnteredLobby | null>(null);
  const [selfId, setSelfId] = useState<string | undefined>(getSocket().id);

  useEffect(() => {
    const s = getSocket();
    if (!s.id) {
      const onConnect = () => setSelfId(s.id);
      s.on('connect', onConnect);
      return () => { s.off('connect', onConnect); };
    }
  }, []);

  useEffect(() => {
    const s = getSocket();
    const onState = (state: LobbyState | null) => {
      if (!state) {
        setEntered(null);
        return;
      }
      setEntered((prev) => (prev ? { ...prev, lobby: state } : prev));
    };
    s.on('lobby:state', onState);
    return () => { s.off('lobby:state', onState); };
  }, []);

  function handleLeave() {
    getSocket().emit('lobby:leave');
    setEntered(null);
  }

  // Browser back / nav-away: leave lobby on unmount. Server no-ops if not in one.
  useEffect(() => {
    return () => {
      getSocket().emit('lobby:leave');
    };
  }, []);

  if (!entered || !selfId) {
    return (
      <LobbyList
        onEntered={(res, role, character) => setEntered({ lobby: res.lobby, role, character })}
      />
    );
  }

  return (
    <GameCanvas
      lobby={entered.lobby}
      selfId={selfId}
      variant={entered.character}
      role={entered.role}
      onLeave={handleLeave}
    />
  );
}
