import { useEffect, useState } from 'react';
import type { LobbyInfo, LobbyResult, Role } from '@pwa-demo/shared';
import { getSocket } from '../../lib/socket';
import CharacterPicker from './CharacterPicker';

const NAME_KEY = 'pwademo:displayName';
const CHAR_KEY = 'pwademo:character';

function loadName(): string {
  return localStorage.getItem(NAME_KEY) ?? `Player-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function loadChar(): number {
  return Number(localStorage.getItem(CHAR_KEY) ?? '0');
}

export default function LobbyList({
  onEntered,
}: {
  onEntered: (lobby: LobbyResult & { ok: true }, role: Role, character: number) => void;
}) {
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [name, setName] = useState(loadName);
  const [character, setCharacter] = useState<number>(loadChar);
  const [creating, setCreating] = useState(false);
  const [lobbyName, setLobbyName] = useState('');
  const [hostRole, setHostRole] = useState<Role>('player');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name);
  }, [name]);

  useEffect(() => {
    localStorage.setItem(CHAR_KEY, String(character));
  }, [character]);

  useEffect(() => {
    const s = getSocket();
    s.emit('lobby:browser:join');
    const onList = (list: LobbyInfo[]) => setLobbies(list);
    s.on('lobby:list', onList);
    return () => {
      s.off('lobby:list', onList);
      s.emit('lobby:browser:leave');
    };
  }, []);

  function safeName(): string {
    return name.trim() || 'Player';
  }

  function handleCreate() {
    setBusy(true);
    setError(null);
    getSocket().emit(
      'lobby:create',
      { name: lobbyName.trim() || `${safeName()}'s lobby`, displayName: safeName(), character, role: hostRole },
      (res: LobbyResult) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onEntered(res, hostRole, character);
      },
    );
  }

  function handleJoin(id: string) {
    setBusy(true);
    setError(null);
    getSocket().emit(
      'lobby:join',
      { lobbyId: id, displayName: safeName(), character },
      (res: LobbyResult) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onEntered(res, 'player', character);
      },
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Tower Climb</h1>
      <p className="text-slate-400 mb-2">
        Get as high as you can. Jump up the platforms. Pick a lobby to join, or host your own.
      </p>
      <p className="text-slate-500 text-sm mb-8">
        Built with <span className="text-slate-300">three.js</span> +{' '}
        <span className="text-slate-300">react-three-fiber</span> for the 3D scene,{' '}
        <span className="text-slate-300">socket.io</span> for realtime player state sync, and a
        procedurally-generated world (cylindrical tower + ledges + bridges). Pointer Lock for
        mouse-look, touch joystick on mobile.
      </p>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">your character</h2>
        <div className="flex items-end gap-3 mb-4 flex-wrap">
          <label className="block">
            <span className="text-xs text-slate-400">display name</span>
            <input
              type="text"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              className="block mt-1 w-64 bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5"
            />
          </label>
        </div>
        <CharacterPicker value={character} onChange={setCharacter} />
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">host a lobby</h2>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700"
          >
            {creating ? 'cancel' : 'new lobby'}
          </button>
        </div>
        {creating && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-slate-400">lobby name</span>
              <input
                type="text"
                value={lobbyName}
                maxLength={40}
                placeholder={`${safeName()}'s lobby`}
                onChange={(e) => setLobbyName(e.target.value)}
                className="block mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5"
              />
            </label>
            <fieldset>
              <legend className="text-xs text-slate-400 mb-1">join as</legend>
              <div className="flex gap-2">
                <RoleChoice value="player" current={hostRole} onSelect={setHostRole} label="Player" hint="play and be scored" />
                <RoleChoice value="spectator" current={hostRole} onSelect={setHostRole} label="Spectator" hint="free-cam, no scoring" />
              </div>
            </fieldset>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy}
              className="px-4 py-2 rounded-md bg-brand-500 hover:bg-brand-400 text-slate-950 font-medium text-sm disabled:opacity-50"
            >
              {busy ? 'creating…' : 'Create lobby'}
            </button>
          </div>
        )}
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h2 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">open lobbies</h2>
        {lobbies.length === 0 ? (
          <div className="text-sm text-slate-500 py-6 text-center">
            no lobbies yet — be the first to host one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lobbies.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => handleJoin(l.id)}
                disabled={busy || l.playerCount >= l.maxPlayers}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg p-3 text-left transition disabled:opacity-50"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-medium truncate">{l.name}</div>
                  <div className="text-xs text-slate-500 tabular-nums">{l.playerCount}/{l.maxPlayers}</div>
                </div>
                <div className="text-xs text-slate-500">hosted by {l.hostName}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="mt-4 px-3 py-2 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

function RoleChoice({
  value, current, onSelect, label, hint,
}: {
  value: Role; current: Role; onSelect: (r: Role) => void; label: string; hint: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex-1 text-left p-3 rounded-md border transition ${
        active
          ? 'border-brand-500 bg-brand-500/10 text-white'
          : 'border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-300'
      }`}
    >
      <div className="font-medium text-sm">{label}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </button>
  );
}
