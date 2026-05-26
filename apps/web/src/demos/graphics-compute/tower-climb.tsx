/**
 * MULTI-PAGE DEMO — reference example.
 *
 * Multi-page demos own multiple internal screens. Tower Climb has three:
 *   1. Lobby list (find / create a lobby)
 *   2. Character picker (inside a lobby)
 *   3. Play (3D game canvas)
 *
 * The component manages its own sub-navigation via state (existing Game
 * impl). Other multi-page demos can use nested <Route>s instead — both
 * are valid, the registry doesn't care. The route registered for this
 * demo is `/d/tower-climb/*` so internal hash/state changes don't fight
 * with the router.
 *
 * `hideChrome` skips the DemoPage frame because this demo wants the full
 * viewport; star/favorite remains accessible from the sidebar, modal, or
 * a future in-game pause menu.
 */
import { useEffect, useState } from 'react';
import LobbyList from '../../game/lobby/LobbyList';
import GameCanvas from '../../game/GameCanvas';
import { getSocket } from '../../lib/socket';
import type { LobbyState, Role } from '@pwa-demo/shared';

type EnteredLobby = {
  lobby: LobbyState;
  role: Role;
  character: number;
};

export default function TowerClimbDemo() {
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
      if (!state) { setEntered(null); return; }
      setEntered((prev) => (prev ? { ...prev, lobby: state } : prev));
    };
    s.on('lobby:state', onState);
    return () => { s.off('lobby:state', onState); };
  }, []);

  function handleLeave() {
    getSocket().emit('lobby:leave');
    setEntered(null);
  }

  // Leave lobby on unmount (back / nav-away). Server no-ops if not in one.
  useEffect(() => {
    return () => { getSocket().emit('lobby:leave'); };
  }, []);

  if (!entered || !selfId) {
    return (
      <LobbyList
        onEntered={(res, role, character) =>
          setEntered({ lobby: res.lobby, role, character })}
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
