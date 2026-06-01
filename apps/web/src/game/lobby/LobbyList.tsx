import { useEffect, useState } from 'react';
import { containsProfanity, isDedicatedLobbyId, type AuthStatus, type LobbyInfo, type LobbyResult, type Role, type TowerHighScore } from '@pwa-demo/shared';
import { getSocket, hasAdminToken } from '../../lib/socket';
import CharacterPicker from './CharacterPicker';
import ServerAdminMenu, { ShieldIcon } from './ServerAdminMenu';

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
  const [listReceived, setListReceived] = useState(false);
  const [leaderboard, setLeaderboard] = useState<TowerHighScore[]>([]);
  const [name, setName] = useState(loadName);
  const [character, setCharacter] = useState<number>(loadChar);
  const [creating, setCreating] = useState(false);
  const [lobbyName, setLobbyName] = useState('');
  const [hostRole, setHostRole] = useState<Role>('player');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Optimistic from a persisted token (auto-elevated on connect); corrected by
  // auth:status. Drives only the icon tint — the menu re-verifies via the
  // server before showing admin controls.
  const [isAdmin, setIsAdmin] = useState(hasAdminToken);
  const [adminOpen, setAdminOpen] = useState(false);

  // Dedicated servers may be turned off by an admin — Quick Play goes offline.
  const hasDedicated = lobbies.some((l) => isDedicatedLobbyId(l.id));

  // Live profanity check — same logic the server enforces, mirrored in
  // @pwa-demo/shared. Recomputed every render so the warning updates as the
  // user types (the controlled inputs re-render on each keystroke). The
  // server's nameError() remains the authoritative gate; this just blocks the
  // doomed submit and shows *why* right next to the field.
  const nameProfane = containsProfanity(name);
  const lobbyNameProfane = containsProfanity(lobbyName);

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name);
  }, [name]);

  useEffect(() => {
    localStorage.setItem(CHAR_KEY, String(character));
  }, [character]);

  useEffect(() => {
    const s = getSocket();
    s.emit('lobby:browser:join');
    const onList = (list: LobbyInfo[]) => { setLobbies(list); setListReceived(true); };
    const onLeaderboard = (top: TowerHighScore[]) => setLeaderboard(top);
    const onAuth = (status: AuthStatus) => setIsAdmin(status.isAdmin);
    // Socket.IO hands us a fresh socket on reconnect, which is NOT in the
    // server's browser room — re-join so lobby:list / leaderboard (and the
    // "dedicated servers offline" gate derived from them) stay live.
    const onConnect = () => s.emit('lobby:browser:join');
    s.on('lobby:list', onList);
    s.on('tower:leaderboard', onLeaderboard);
    s.on('auth:status', onAuth);
    s.on('connect', onConnect);
    return () => {
      s.off('lobby:list', onList);
      s.off('tower:leaderboard', onLeaderboard);
      s.off('auth:status', onAuth);
      s.off('connect', onConnect);
      s.emit('lobby:browser:leave');
    };
  }, []);

  function safeName(): string {
    return name.trim() || 'Player';
  }

  function handleCreate() {
    if (nameProfane || lobbyNameProfane) return; // buttons are disabled; belt-and-suspenders
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
    if (nameProfane) return; // display name carries into the lobby — block it client-side too
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

  function handleQuickPlay() {
    if (nameProfane) return;
    setBusy(true);
    setError(null);
    getSocket().emit(
      'lobby:quick-join',
      { displayName: safeName(), character },
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
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="text-3xl font-bold">Tower Climb</h1>
        {/* Server admin — token elevation + dedicated-server fleet controls.
            Subtle when anonymous, amber once elevated. */}
        <button
          type="button"
          onClick={() => setAdminOpen(true)}
          title={isAdmin ? 'Server admin' : 'Admin sign-in'}
          aria-label="Server admin"
          className={`shrink-0 mt-1 p-1.5 rounded-md border transition ${
            isAdmin
              ? 'text-amber-300 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20'
              : 'text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700'
          }`}
        >
          <ShieldIcon className="w-4 h-4" />
        </button>
      </div>
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
              aria-invalid={nameProfane}
              className={`block mt-1 w-64 bg-slate-950 border rounded-md px-3 py-1.5 ${
                nameProfane ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700'
              }`}
            />
            {nameProfane && (
              <span className="block mt-1 text-xs text-rose-300">
                That name isn’t allowed — please choose another.
              </span>
            )}
          </label>
        </div>
        <CharacterPicker value={character} onChange={setCharacter} />
      </section>

      {/* Quick Play — drops the user straight into the least-full dedicated
          server. Highest-affordance action on the page so first-time visitors
          can be playing in one click. Goes offline when an admin turns the
          dedicated servers off. */}
      {listReceived && !hasDedicated ? (
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">official server</h2>
              <p className="text-slate-500 text-sm mt-1">
                Dedicated servers are currently offline. Host a private lobby below to play.
              </p>
            </div>
            <button
              type="button"
              disabled
              className="px-5 py-2.5 rounded-md bg-slate-800 text-slate-500 font-semibold text-sm cursor-not-allowed"
            >
              Offline
            </button>
          </div>
        </section>
      ) : (
        <section className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/40 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-medium text-amber-300 uppercase tracking-wider">★ official server</h2>
              <p className="text-slate-300 text-sm mt-1">
                Persistent always-on world. Drop in, climb, get on the leaderboard.
              </p>
            </div>
            <button
              type="button"
              onClick={handleQuickPlay}
              disabled={busy || nameProfane}
              className="px-5 py-2.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm disabled:opacity-50 shadow-md"
            >
              {busy ? 'joining…' : 'Quick Play →'}
            </button>
          </div>
        </section>
      )}

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">host a private lobby</h2>
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
                aria-invalid={lobbyNameProfane}
                className={`block mt-1 w-full bg-slate-950 border rounded-md px-3 py-1.5 ${
                  lobbyNameProfane ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700'
                }`}
              />
              {lobbyNameProfane && (
                <span className="block mt-1 text-xs text-rose-300">
                  That lobby name isn’t allowed — please choose another.
                </span>
              )}
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
              disabled={busy || nameProfane || lobbyNameProfane}
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
            {lobbies.map((l) => {
              const official = isDedicatedLobbyId(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => (official ? handleQuickPlay() : handleJoin(l.id))}
                  disabled={busy || nameProfane || l.playerCount >= l.maxPlayers}
                  className={`rounded-lg p-3 text-left transition disabled:opacity-50 ${
                    official
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40'
                      : 'bg-slate-950 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <div className={`font-medium truncate ${official ? 'text-amber-200' : ''}`}>{l.name}</div>
                    <div className="text-xs text-slate-500 tabular-nums">{l.playerCount}/{l.maxPlayers}</div>
                  </div>
                  <div className="text-xs text-slate-500">hosted by {l.hostName}</div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Persistent leaderboard — cross-session scores from the Official
          Server. Empty state communicates that scores are recorded when a
          player leaves the server, so a new visitor knows what to expect. */}
      <section className="mt-6 bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            ★ all-time leaderboard
          </h2>
          <span className="text-[10px] text-slate-600 uppercase tracking-wider">official server</span>
        </div>
        {leaderboard.length === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center">
            no scores yet — be the first to climb the Official Server.
          </div>
        ) : (
          <ol className="space-y-1">
            {leaderboard.map((s, i) => (
              <li key={`${s.displayName}-${s.character}-${s.achievedAt}`} className="flex items-baseline gap-2 text-sm">
                <span className="w-6 text-right text-slate-500 tabular-nums">{i + 1}.</span>
                <span className="flex-1 truncate text-slate-200">{s.displayName}</span>
                <span className="font-mono tabular-nums text-amber-300">{s.maxHeight.toFixed(1)}m</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {error && (
        <div className="mt-4 px-3 py-2 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm">
          {error}
        </div>
      )}

      <ServerAdminMenu open={adminOpen} onClose={() => setAdminOpen(false)} />
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
