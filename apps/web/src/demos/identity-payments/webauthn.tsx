import { useState } from 'react';
import { Link } from 'react-router';
import { Btn, Out } from '../_shared/ui';
import { b64uEncode, b64uDecode } from '../_shared/b64';

const WEBAUTHN_CRED_KEY = 'demo:webauthn:credId';
const WEBAUTHN_USER_KEY = 'demo:webauthn:user';

export default function WebAuthnDemo() {
  // Self-contained register/authenticate demo. A real app verifies the
  // assertion server-side; here we just prove the browser can create and
  // assert a credential against the same origin. The credential ID lives
  // in localStorage so "sign in" works across reloads.
  const [username, setUsername] = useState('demo@example.com');
  const [storedUser, setStoredUser] = useState<string | null>(
    typeof window === 'undefined' ? null : window.localStorage.getItem(WEBAUTHN_USER_KEY),
  );
  const [out, setOut] = useState<{ tone: 'default' | 'ok' | 'err'; msg: string }>({
    tone: 'default', msg: '—',
  });
  const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;

  async function register() {
    if (!supported) return setOut({ tone: 'err', msg: 'unsupported' });
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'PWA Demo', id: location.hostname },
          user: { id: userId, name: username, displayName: username },
          // ES256 + RS256 cover virtually every authenticator in the wild.
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
          attestation: 'none',
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!cred) return setOut({ tone: 'err', msg: 'create() returned null' });
      const credId = b64uEncode(cred.rawId);
      window.localStorage.setItem(WEBAUTHN_CRED_KEY, credId);
      window.localStorage.setItem(WEBAUTHN_USER_KEY, username);
      setStoredUser(username);
      setOut({ tone: 'ok', msg: `registered passkey for ${username} (id: ${credId.slice(0, 12)}…)` });
    } catch (e) {
      setOut({ tone: 'err', msg: (e as Error).message });
    }
  }

  async function authenticate() {
    if (!supported) return setOut({ tone: 'err', msg: 'unsupported' });
    const credId = window.localStorage.getItem(WEBAUTHN_CRED_KEY);
    if (!credId) return setOut({ tone: 'err', msg: 'no credential — register first' });
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: b64uDecode(credId).buffer as ArrayBuffer, type: 'public-key' }],
          userVerification: 'preferred',
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!assertion) return setOut({ tone: 'err', msg: 'get() returned null' });
      setOut({ tone: 'ok', msg: `signed in as ${storedUser} — assertion ${assertion.id.slice(0, 12)}…` });
    } catch (e) {
      setOut({ tone: 'err', msg: (e as Error).message });
    }
  }

  function forget() {
    window.localStorage.removeItem(WEBAUTHN_CRED_KEY);
    window.localStorage.removeItem(WEBAUTHN_USER_KEY);
    setStoredUser(null);
    setOut({ tone: 'default', msg: 'cleared local credential (the authenticator still has it)' });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={!!storedUser}
          placeholder="user@example.com"
          className="flex-1 min-w-[12rem] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono disabled:opacity-60"
        />
        <Btn onClick={register} disabled={!supported || !!storedUser}>Register passkey</Btn>
        <Btn onClick={authenticate} disabled={!supported || !storedUser}>Sign in</Btn>
        <Btn variant="ghost" onClick={forget} disabled={!storedUser}>Forget</Btn>
      </div>
      <div className="text-[10px] text-slate-500">
        {storedUser ? `Saved credential for ${storedUser}` : 'No credential stored yet'}
      </div>
      <Out tone={out.tone}>{out.msg}</Out>
      <div className="mt-1.5">
        <Link to="/d/passkeys" className="text-xs text-brand-400 hover:text-brand-300 underline">
          Full demo (server verification + diagnostics)
        </Link>
      </div>
    </div>
  );
}
