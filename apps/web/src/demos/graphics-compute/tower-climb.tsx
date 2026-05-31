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
import { useEffect, useRef, useState } from 'react';
import LobbyList from '../../game/lobby/LobbyList';
import GameCanvas from '../../game/GameCanvas';
import WorldPreview from '../../game/WorldPreview';
import { getSocket, getClientId } from '../../lib/socket';
import type { LobbyResult, LobbyState, Role } from '@pwa-demo/shared';

type EnteredLobby = {
  lobby: LobbyState;
  role: Role;
  character: number;
};

export default function TowerClimbDemo() {
  // Dev-only no-socket world preview for headless look-and-feel validation.
  // ?preview=<presetName> (or ?preview=1 with cx/cy/cz/tx/ty/tz coords).
  const preview = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('preview')
    : null;
  if (preview) return <WorldPreview preset={preview} />;
  return <TowerClimbGame />;
}

function TowerClimbGame() {
  const [entered, setEntered] = useState<EnteredLobby | null>(null);
  const [selfId, setSelfId] = useState<string | undefined>(getSocket().id);
  // Stable identity for this tab — unlike selfId it never changes on reconnect,
  // so the game uses it to recognize its own avatar (see GameCanvas).
  const selfClientId = getClientId();

  // Latest `entered`, readable by the reconnect handler below without it having
  // to re-subscribe every time the lobby state changes.
  const enteredRef = useRef(entered);
  enteredRef.current = entered;

  useEffect(() => {
    const s = getSocket();
    // selfId follows the live socket id, which Socket.IO regenerates on every
    // reconnect. On a reconnect we also transparently re-join the lobby we were
    // in: the fresh socket isn't a member server-side, and re-joining evicts
    // our pre-reconnect ghost record — the stale "second character".
    const onConnect = () => {
      setSelfId(s.id);
      const e = enteredRef.current;
      if (!e || e.role !== 'player') return; // spectators re-enter via the list
      let displayName = 'Player';
      try { displayName = localStorage.getItem('pwademo:displayName') ?? 'Player'; } catch { /* noop */ }
      const onResult = (res: LobbyResult) => {
        if (!res.ok) { setEntered(null); return; } // lobby gone — back to the list
        setEntered((prev) => (prev ? { ...prev, lobby: res.lobby } : prev));
      };
      // Rejoin the exact lobby we were in by its stable id. Dedicated servers
      // persist, so this re-associates us with the same one (quick-join could
      // land us on a different dedicated server). If it's gone — private lobby
      // dissolved, or an admin reduced the dedicated count — we fall back to
      // the lobby list via the !res.ok branch above.
      s.emit('lobby:join', { lobbyId: e.lobby.id, displayName, character: e.character }, onResult);
    };
    s.on('connect', onConnect);
    return () => { s.off('connect', onConnect); };
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
      selfClientId={selfClientId}
      variant={entered.character}
      role={entered.role}
      onLeave={handleLeave}
    />
  );
}
