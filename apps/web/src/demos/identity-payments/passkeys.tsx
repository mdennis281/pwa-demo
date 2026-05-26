import { useEffect, useRef, useState } from 'react';
import { DemoPage } from '../_DemoPage';
import { b64uEncode, b64uDecode } from '../_shared/b64';

// ─── Types ────────────────────────────────────────────────────────────────────

type LogTone = 'ok' | 'err' | 'warn' | 'info';
type LogEntry = { id: number; ts: number; tone: LogTone; msg: string };
type CredInfo = { id: string; alg: string; transport: string[]; aaguid: string; signCount: number; createdAt: number };
type RegisterResult = { credentialId: string; algName: string; transport: string[]; aaguid: string; signCount: number; uvFlag: boolean; origin: string; rpId: string };
type AuthResult = { userId: string; credentialId: string; signCount: number; uvFlag: boolean; algName: string; warning: string | null };

// ─── Tiny shared components ───────────────────────────────────────────────────

const btn = 'px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-medium text-xs transition';
const btnGhost = 'px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs transition';

function Pill({ state, children }: { state: 'ok' | 'err' | 'warn' | 'unknown' | 'checking'; children: React.ReactNode }) {
  const colors = {
    ok: 'bg-emerald-900/60 text-emerald-300',
    err: 'bg-rose-900/60 text-rose-300',
    warn: 'bg-amber-900/60 text-amber-300',
    unknown: 'bg-slate-800 text-slate-400',
    checking: 'bg-slate-800 text-slate-500 animate-pulse',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wide ${colors[state]}`}>
      {children}
    </span>
  );
}

function PrereqRow({ label, state, detail }: { label: string; state: 'ok' | 'err' | 'warn' | 'unknown' | 'checking'; detail?: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-800 last:border-0">
      <span className="flex-1 text-xs text-slate-300">{label}</span>
      <div className="flex flex-col items-end gap-0.5">
        <Pill state={state}>{state === 'checking' ? '…' : state}</Pill>
        {detail && <span className="text-[10px] text-slate-500 text-right max-w-[16rem]">{detail}</span>}
      </div>
    </div>
  );
}

// ─── Prerequisites panel ──────────────────────────────────────────────────────

function Prerequisites() {
  const isSecure = window.isSecureContext;
  const apiAvail = 'PublicKeyCredential' in window;

  const [platformAvail, setPlatformAvail] = useState<boolean | null>(null);
  const [conditionalAvail, setConditionalAvail] = useState<boolean | null>(null);

  useEffect(() => {
    if (!apiAvail) return;
    const PKC = PublicKeyCredential as typeof PublicKeyCredential & {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
      isConditionalMediationAvailable?: () => Promise<boolean>;
    };
    PKC.isUserVerifyingPlatformAuthenticatorAvailable?.().then(setPlatformAvail).catch(() => setPlatformAvail(false));
    PKC.isConditionalMediationAvailable?.().then(setConditionalAvail).catch(() => setConditionalAvail(false));
  }, [apiAvail]);

  const notReady = !isSecure || !apiAvail;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-slate-200">Prerequisites</h2>
      <div>
        <PrereqRow
          label="Secure context (HTTPS or localhost)"
          state={isSecure ? 'ok' : 'err'}
          detail={isSecure ? undefined : 'WebAuthn requires HTTPS. Use localhost for dev, or deploy with TLS.'}
        />
        <PrereqRow
          label="PublicKeyCredential API"
          state={apiAvail ? 'ok' : 'err'}
          detail={apiAvail ? undefined : 'Your browser does not support WebAuthn. Try Chrome, Edge, Safari, or Firefox 60+.'}
        />
        <PrereqRow
          label="Platform authenticator (Touch ID / Windows Hello / Face ID)"
          state={platformAvail === null ? (apiAvail ? 'checking' : 'unknown') : platformAvail ? 'ok' : 'warn'}
          detail={platformAvail === false ? 'No built-in biometric authenticator. You can still use a USB security key.' : undefined}
        />
        <PrereqRow
          label="Conditional mediation (passkey autofill)"
          state={conditionalAvail === null ? (apiAvail ? 'checking' : 'unknown') : conditionalAvail ? 'ok' : 'warn'}
          detail={conditionalAvail === false ? 'Browser does not support passkey autofill — the demo will use a button-triggered flow instead.' : conditionalAvail ? 'Passkeys can appear in the username autocomplete dropdown.' : undefined}
        />
      </div>
      {notReady && (
        <p className="text-xs text-amber-300 bg-amber-950/40 rounded-lg p-3">
          This page must be served over HTTPS (or localhost). WebAuthn credentials are origin-bound — the browser enforces this at a platform level.
        </p>
      )}
    </section>
  );
}

// ─── How it works diagram ─────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-slate-200">How passkeys work</h2>
      <div className="grid grid-cols-2 gap-3 text-[11px]">
        {[
          { step: '1', label: 'Registration', body: 'Browser generates a key pair in the authenticator (TPM / Secure Enclave). Private key never leaves the device.' },
          { step: '2', label: 'Challenge', body: 'Server sends a random 32-byte challenge. Replaying old responses is impossible — each challenge is consumed once.' },
          { step: '3', label: 'Signature', body: 'Authenticator signs authData + SHA-256(clientDataJSON) with the private key after user verification (biometric / PIN).' },
          { step: '4', label: 'Verification', body: 'Server checks the signature against the stored public key, verifies origin + rpId hash, and updates the sign count.' },
        ].map(({ step, label, body }) => (
          <div key={step} className="bg-slate-950/60 rounded-lg p-3 border border-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-300 text-[10px] font-bold flex items-center justify-center">{step}</span>
              <span className="font-medium text-slate-200">{label}</span>
            </div>
            <p className="text-slate-400 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Credential inspector card ────────────────────────────────────────────────

function CredCard({ label, result }: { label: string; result: RegisterResult | AuthResult }) {
  const isReg = 'rpId' in result;
  const rows: [string, React.ReactNode][] = isReg
    ? [
        ['Algorithm', (result as RegisterResult).algName],
        ['Transport', (result as RegisterResult).transport.length
          ? (result as RegisterResult).transport.map((t) => (
              <span key={t} className="inline-block mr-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">{t}</span>
            ))
          : <span className="text-slate-500">none reported</span>],
        ['AAGUID', (result as RegisterResult).aaguid === 'zeroed'
          ? <span className="text-slate-400">zeroed <span className="text-slate-500">(privacy-preserving)</span></span>
          : <span className="font-mono text-slate-300 text-[10px]">{(result as RegisterResult).aaguid}</span>],
        ['Sign count', String((result as RegisterResult).signCount)],
        ['User verified (UV)', (result as RegisterResult).uvFlag ? <span className="text-emerald-300">yes</span> : <span className="text-amber-300">no</span>],
        ['Origin', (result as RegisterResult).origin],
        ['RP ID', (result as RegisterResult).rpId],
        ['Credential ID', (result as RegisterResult).credentialId],
      ]
    : [
        ['Signed in as', (result as AuthResult).userId],
        ['Algorithm', (result as AuthResult).algName],
        ['Sign count', String((result as AuthResult).signCount)],
        ['User verified (UV)', (result as AuthResult).uvFlag ? <span className="text-emerald-300">yes</span> : <span className="text-amber-300">no</span>],
        ['Credential ID', (result as AuthResult).credentialId],
        ...(((result as AuthResult).warning)
          ? [['Warning', <span key="w" className="text-amber-300">{(result as AuthResult).warning}</span>] as [string, React.ReactNode]]
          : []),
      ];

  return (
    <div className="bg-slate-950/60 border border-emerald-800/40 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-emerald-400 text-sm">✓</span>
        <span className="text-xs font-semibold text-emerald-300">Server verified — {label}</span>
      </div>
      <div className="divide-y divide-slate-800">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-4 py-1.5 text-[11px]">
            <span className="w-32 text-slate-500 shrink-0">{k}</span>
            <span className="text-slate-300 font-mono break-all">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Log panel ────────────────────────────────────────────────────────────────

function EventLog({ entries }: { entries: LogEntry[] }) {
  const colors: Record<LogTone, string> = {
    ok: 'text-emerald-300',
    err: 'text-rose-300',
    warn: 'text-amber-300',
    info: 'text-slate-400',
  };
  if (entries.length === 0) return null;
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Log</h2>
      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.id} className="flex gap-3 text-[11px]">
            <span className="text-slate-600 tabular-nums shrink-0">{new Date(e.ts).toLocaleTimeString()}</span>
            <span className={colors[e.tone]}>{e.msg}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Failure modes reference ──────────────────────────────────────────────────

const FAILURE_MODES = [
  {
    error: 'NotAllowedError',
    causes: ['User dismissed the browser prompt', 'Timed out (default: 60 s)', 'No matching credential found during authentication'],
    fix: 'Inform the user and allow retry. Do not treat a cancelled prompt as a security event.',
  },
  {
    error: 'InvalidStateError',
    causes: ['Credential already registered on this authenticator (excludeCredentials matched)'],
    fix: 'The credential is already registered. Allow the user to authenticate, or enroll a different authenticator.',
  },
  {
    error: 'SecurityError',
    causes: ['Page not served over HTTPS (or localhost)', 'rp.id is not a registrable suffix of the origin'],
    fix: 'Serve over HTTPS. rp.id must equal the origin hostname or a parent domain — not a sub-path or port.',
  },
  {
    error: 'NotSupportedError',
    causes: ['None of the requested pubKeyCredParams algorithms are supported by this authenticator'],
    fix: 'Always include both ES256 (alg: -7) and RS256 (alg: -257) to maximise compatibility.',
  },
  {
    error: 'TypeError',
    causes: ['Malformed options object (wrong types, missing required fields)'],
    fix: 'Validate your options before calling create/get. challenge and user.id must be BufferSource, not strings.',
  },
  {
    error: 'AbortError',
    causes: ['AbortController signal fired before the ceremony completed'],
    fix: 'Expected behaviour when you cancel an in-flight ceremony. Clean up any pending UI state.',
  },
  {
    error: 'Server: origin mismatch',
    causes: ['clientDataJSON.origin does not match the expected origin on the server'],
    fix: 'Verify the full origin (scheme + hostname + port) on the server. Common cause: HTTP vs HTTPS mismatch, or wrong port in dev.',
  },
  {
    error: 'Server: rpIdHash mismatch',
    causes: ['The authenticator used a different RP ID than the server expected'],
    fix: 'Ensure rp.id in creation options exactly matches what the server uses for SHA-256 hashing.',
  },
  {
    error: 'Server: sign count regression',
    causes: ['newSignCount ≤ storedSignCount (and newSignCount ≠ 0)', 'Possible cloned authenticator or counter not incrementing'],
    fix: 'Flag the account for review. Many platform authenticators (iCloud Keychain, Google Password Manager) use signCount=0 — treat 0 as "not supported", not as an attack.',
  },
  {
    error: 'Server: signature verification failed',
    causes: ['Credential lookup returned the wrong public key', 'Signature bytes were corrupted in transit', 'Wrong algorithm used for verification'],
    fix: 'Ensure you store the exact COSE-encoded public key from registration and use the correct algorithm for the credential.',
  },
];

function FailureModes() {
  const [open, setOpen] = useState(false);
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-800/50 transition"
      >
        <h2 className="text-sm font-semibold text-slate-200">Failure mode reference</h2>
        <span className="text-slate-500 text-xs">{open ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4">
          {FAILURE_MODES.map((fm) => (
            <div key={fm.error} className="border-l-2 border-slate-700 pl-3 space-y-1">
              <div className="text-xs font-mono font-semibold text-rose-300">{fm.error}</div>
              <ul className="text-[11px] text-slate-400 space-y-0.5">
                {fm.causes.map((c, i) => <li key={i} className="before:content-['·'] before:mr-1">{c}</li>)}
              </ul>
              <p className="text-[11px] text-slate-500 italic">{fm.fix}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PasskeysPage() {
  const apiAvail = 'PublicKeyCredential' in window;
  const [username, setUsername] = useState('demo@example.com');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [serverCreds, setServerCreds] = useState<CredInfo[]>([]);
  const [regResult, setRegResult] = useState<RegisterResult | null>(null);
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);
  const logId = useRef(0);

  function addLog(tone: LogTone, msg: string) {
    setLog((prev) => [{ id: logId.current++, ts: Date.now(), tone, msg }, ...prev].slice(0, 20));
  }

  async function fetchCreds(user = username) {
    try {
      const r = await fetch(`/api/passkeys/credentials?userId=${encodeURIComponent(user)}`);
      const j = await r.json();
      setServerCreds(j.credentials ?? []);
    } catch {/* best effort */}
  }

  async function register() {
    if (!apiAvail) return addLog('err', 'WebAuthn not supported in this browser');
    setBusy(true);
    setRegResult(null);
    try {
      addLog('info', `Requesting registration challenge for ${username}…`);
      const chalRes = await fetch('/api/passkeys/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'register', userId: username }),
      });
      const { sessionId, options } = await chalRes.json();

      // Transform server options: decode base64url → BufferSource
      const createOptions: PublicKeyCredentialCreationOptions = {
        ...options,
        challenge: b64uDecode(options.challenge),
        user: { ...options.user, id: b64uDecode(options.user.id) },
        excludeCredentials: options.excludeCredentials?.map((c: { id: string; type: string; transports: string[] }) => ({
          ...c, id: b64uDecode(c.id),
        })) ?? [],
      };

      addLog('info', 'Browser prompting for authenticator…');
      const credential = await navigator.credentials.create({ publicKey: createOptions }) as PublicKeyCredential | null;
      if (!credential) throw new Error('create() returned null');

      const attestationResponse = credential.response as AuthenticatorAttestationResponse & {
        getTransports?: () => string[];
      };

      addLog('info', 'Sending credential to server for verification…');
      const regRes = await fetch('/api/passkeys/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          credential: {
            id: credential.id,
            rawId: b64uEncode(credential.rawId),
            type: credential.type,
            transports: attestationResponse.getTransports?.() ?? [],
            response: {
              clientDataJSON: b64uEncode(attestationResponse.clientDataJSON),
              attestationObject: b64uEncode(attestationResponse.attestationObject),
            },
          },
        }),
      });

      const result = await regRes.json();
      if (!result.ok) throw new Error(result.error);

      setRegResult(result as RegisterResult);
      setAuthResult(null);
      addLog('ok', `Passkey registered for ${username} — algorithm: ${result.algName}, transport: ${result.transport.join(', ') || 'unknown'}`);
      await fetchCreds();
    } catch (e) {
      const msg = (e as Error).message;
      addLog('err', `Registration failed: ${msg}`);
      diagnose(msg);
    } finally {
      setBusy(false);
    }
  }

  async function authenticate() {
    if (!apiAvail) return addLog('err', 'WebAuthn not supported in this browser');
    setBusy(true);
    setAuthResult(null);
    try {
      addLog('info', `Requesting authentication challenge for ${username}…`);
      const chalRes = await fetch('/api/passkeys/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'authenticate', userId: username }),
      });
      const { sessionId, options } = await chalRes.json();

      const getOptions: PublicKeyCredentialRequestOptions = {
        ...options,
        challenge: b64uDecode(options.challenge),
        allowCredentials: options.allowCredentials?.map((c: { id: string; type: string; transports: string[] }) => ({
          ...c, id: b64uDecode(c.id),
        })) ?? [],
      };

      if (serverCreds.length === 0 && getOptions.allowCredentials?.length === 0) {
        addLog('warn', 'No registered credentials for this user. Register first.');
        setBusy(false);
        return;
      }

      addLog('info', 'Browser prompting for authenticator…');
      const credential = await navigator.credentials.get({ publicKey: getOptions }) as PublicKeyCredential | null;
      if (!credential) throw new Error('get() returned null');

      const assertionResponse = credential.response as AuthenticatorAssertionResponse;

      addLog('info', 'Sending assertion to server for verification…');
      const authRes = await fetch('/api/passkeys/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          credential: {
            id: credential.id,
            rawId: b64uEncode(credential.rawId),
            type: credential.type,
            response: {
              clientDataJSON: b64uEncode(assertionResponse.clientDataJSON),
              authenticatorData: b64uEncode(assertionResponse.authenticatorData),
              signature: b64uEncode(assertionResponse.signature),
              userHandle: assertionResponse.userHandle ? b64uEncode(assertionResponse.userHandle) : null,
            },
          },
        }),
      });

      const result = await authRes.json();
      if (!result.ok) throw new Error(result.error);

      setAuthResult(result as AuthResult);
      setRegResult(null);
      addLog('ok', `Signed in as ${result.userId} — sign count: ${result.signCount}${result.warning ? ` ⚠ ${result.warning}` : ''}`);
      if (result.warning) addLog('warn', result.warning);
      await fetchCreds();
    } catch (e) {
      const msg = (e as Error).message;
      addLog('err', `Authentication failed: ${msg}`);
      diagnose(msg);
    } finally {
      setBusy(false);
    }
  }

  async function forget() {
    try {
      await fetch(`/api/passkeys/credentials?userId=${encodeURIComponent(username)}`, { method: 'DELETE' });
      setServerCreds([]);
      setRegResult(null);
      setAuthResult(null);
      addLog('info', `Server credentials cleared for ${username}. Note: the passkey still exists in the authenticator.`);
    } catch (e) {
      addLog('err', (e as Error).message);
    }
  }

  function diagnose(msg: string) {
    const lower = msg.toLowerCase();
    if (lower.includes('notallowederror') || lower.includes('not allowed')) {
      addLog('info', 'Tip: NotAllowedError usually means the user cancelled, dismissed the prompt, or it timed out.');
    } else if (lower.includes('invalidstateerror') || lower.includes('invalid state')) {
      addLog('info', 'Tip: InvalidStateError means this authenticator already has a credential for this user (excludeCredentials matched).');
    } else if (lower.includes('securityerror') || lower.includes('security')) {
      addLog('info', 'Tip: SecurityError means the page is not in a secure context, or rp.id does not match the origin hostname.');
    } else if (lower.includes('notsupportederror') || lower.includes('not supported')) {
      addLog('info', 'Tip: NotSupportedError means no authenticator supports the requested algorithm. Ensure ES256 (-7) is in pubKeyCredParams.');
    }
  }

  const hasRegistered = serverCreds.length > 0;

  return (
    <DemoPage
      id="passkeys"
      title="Passkeys (full diagnostic)"
      blurb="Server-verified WebAuthn with diagnostics."
      maxWidth="4xl"
    >
      <div className="space-y-6">
        <Prerequisites />
        <HowItWorks />

        {/* ── Try it ─────────────────────────────────────────────────────── */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">Try it</h2>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 min-w-[14rem] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={register} disabled={!apiAvail || busy} className={btn}>
              Register passkey
            </button>
            <button onClick={authenticate} disabled={!apiAvail || busy} className={btn}>
              Sign in
            </button>
            <button onClick={forget} disabled={!hasRegistered || busy} className={btnGhost}>
              Forget
            </button>
          </div>

          {hasRegistered && (
            <div className="text-[11px] text-slate-500">
              {serverCreds.length} credential{serverCreds.length !== 1 ? 's' : ''} registered on server for {username}
              {serverCreds.map((c) => (
                <div key={c.id} className="mt-1 flex gap-3 font-mono text-[10px] text-slate-600">
                  <span>{c.id}</span>
                  <span className="text-slate-700">{c.alg}</span>
                  <span className="text-slate-700">{c.transport.join(', ') || '?'}</span>
                  <span className="text-slate-700">count: {c.signCount}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-slate-600">
            Server state is in-memory — credentials are lost on server restart. The passkey itself stays in your authenticator.
          </p>
        </section>

        {/* ── Credential inspector ───────────────────────────────────────── */}
        {regResult && <CredCard label="registration" result={regResult} />}
        {authResult && <CredCard label="authentication" result={authResult} />}

        {/* ── Event log ──────────────────────────────────────────────────── */}
        <EventLog entries={log} />

        <FailureModes />
      </div>
    </DemoPage>
  );
}
