import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function CredMgmtDemo() {
  // Browser-managed PASSWORD credentials (the original Credential Management
  // API — different from WebAuthn/passkeys above). Save triggers the
  // browser's "Save password?" prompt; Auto-fill triggers the account
  // chooser. Chromium-only: Firefox/Safari implement navigator.credentials
  // but not PasswordCredential, so the constructor is the supported check.
  const [username, setUsername] = useState('demo@example.com');
  const [password, setPassword] = useState('hunter2-demo');
  const [out, setOut] = useState<{ tone: 'default' | 'ok' | 'err'; msg: string }>({
    tone: 'default', msg: '—',
  });
  // PasswordCredential is non-standard in lib.dom — narrow via globalThis.
  type PasswordCredentialCtor = new (init: { id: string; password: string; name?: string }) => unknown;
  const W = window as Window & { PasswordCredential?: PasswordCredentialCtor };
  const supported = typeof window !== 'undefined' && typeof W.PasswordCredential === 'function';

  async function save() {
    if (!supported) return setOut({ tone: 'err', msg: 'PasswordCredential unsupported (Chromium only)' });
    try {
      const cred = new W.PasswordCredential!({ id: username, password, name: username });
      await navigator.credentials.store(cred as Credential);
      setOut({ tone: 'ok', msg: `stored — accept the browser prompt to confirm save for ${username}` });
    } catch (e) {
      setOut({ tone: 'err', msg: (e as Error).message });
    }
  }

  async function autofill() {
    if (!('credentials' in navigator)) return setOut({ tone: 'err', msg: 'unsupported' });
    try {
      // `mediation: 'optional'` shows the account chooser only when a saved
      // credential matches this origin; 'required' forces it every time.
      const cred = (await navigator.credentials.get({
        password: true,
        mediation: 'optional',
      } as CredentialRequestOptions)) as (Credential & { id?: string; password?: string }) | null;
      if (!cred) return setOut({ tone: 'default', msg: 'no credential picked (user dismissed or none saved)' });
      setUsername(cred.id ?? '');
      setPassword(cred.password ?? '');
      setOut({ tone: 'ok', msg: `auto-filled credential for ${cred.id}` });
    } catch (e) {
      setOut({ tone: 'err', msg: (e as Error).message });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="username"
          className="flex-1 min-w-[10rem] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="password"
          className="flex-1 min-w-[10rem] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={save} disabled={!supported || !username || !password}>Save to browser</Btn>
        <Btn variant="ghost" onClick={autofill}>Auto-fill</Btn>
      </div>
      <Out tone={out.tone}>{out.msg}</Out>
    </div>
  );
}
