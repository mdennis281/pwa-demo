import { Router } from 'express';
import crypto from 'node:crypto';

const router = Router();

// ─── Types ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cbor = any;

type StoredChallenge = {
  value: string;
  type: 'register' | 'authenticate';
  userId: string;
  rpId: string;
  expires: number;
};

type StoredCredential = {
  id: string;
  userId: string;
  publicKeyCose: Uint8Array;
  alg: number;
  signCount: number;
  transport: string[];
  aaguid: string;
  createdAt: number;
};

// ─── In-memory stores ─────────────────────────────────────────────────────────
// Demo-only: restart clears all state, which is fine for this use case.

const pendingChallenges = new Map<string, StoredChallenge>();
const storedCredentials = new Map<string, StoredCredential>();
const userCredentials = new Map<string, Set<string>>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingChallenges) {
    if (v.expires < now) pendingChallenges.delete(k);
  }
}, 60_000).unref();

// ─── CBOR decoder ─────────────────────────────────────────────────────────────
// Minimal decoder covering the CBOR subset used by WebAuthn (attObj + COSE keys).

function cborReadLen(buf: Buffer, offset: number, addl: number): [number, number] {
  if (addl < 24) return [addl, offset];
  if (addl === 24) return [buf[offset], offset + 1];
  if (addl === 25) return [buf.readUInt16BE(offset), offset + 2];
  if (addl === 26) return [buf.readUInt32BE(offset), offset + 4];
  throw new Error(`CBOR: unsupported length encoding ${addl}`);
}

function decodeCbor(buf: Buffer, offset: number): [Cbor, number] {
  const initial = buf[offset++];
  const mt = (initial >> 5) & 0x7;
  const addl = initial & 0x1f;
  let len: number;
  [len, offset] = cborReadLen(buf, offset, addl);

  if (mt === 0) return [len, offset];
  if (mt === 1) return [-1 - len, offset];
  if (mt === 2) return [buf.subarray(offset, offset + len), offset + len];
  if (mt === 3) return [buf.subarray(offset, offset + len).toString('utf8'), offset + len];
  if (mt === 4) {
    const arr: Cbor[] = [];
    for (let i = 0; i < len; i++) {
      const [v, o] = decodeCbor(buf, offset);
      arr.push(v); offset = o;
    }
    return [arr, offset];
  }
  if (mt === 5) {
    const map = new Map<Cbor, Cbor>();
    for (let i = 0; i < len; i++) {
      const [k, o1] = decodeCbor(buf, offset);
      const [v, o2] = decodeCbor(buf, o1);
      map.set(k, v); offset = o2;
    }
    return [map, offset];
  }
  if (mt === 6) return decodeCbor(buf, offset); // tagged value — skip the tag
  throw new Error(`CBOR: unsupported major type ${mt}`);
}

// ─── authenticatorData parser ─────────────────────────────────────────────────

function parseAuthData(buf: Buffer) {
  // Layout: [32 rpIdHash] [1 flags] [4 signCount] [AT data if AT flag set]
  const rpIdHash = buf.subarray(0, 32);
  const flags = {
    up: !!(buf[32] & 0x01), // user presence
    uv: !!(buf[32] & 0x04), // user verification
    at: !!(buf[32] & 0x40), // attested credential data present
  };
  const signCount = buf.readUInt32BE(33);

  let credentialId: Buffer | undefined;
  let coseKey: Map<Cbor, Cbor> | undefined;
  let coseKeyRaw: Buffer | undefined;
  let aaguid: Buffer | undefined;

  if (flags.at && buf.length > 37) {
    let off = 37;
    aaguid = buf.subarray(off, off + 16); off += 16;
    const credIdLen = buf.readUInt16BE(off); off += 2;
    credentialId = buf.subarray(off, off + credIdLen); off += credIdLen;
    const coseStart = off;
    const [ck, coseEnd] = decodeCbor(buf, coseStart);
    coseKey = ck as Map<Cbor, Cbor>;
    // Copy so the stored bytes are independent of the request buffer
    coseKeyRaw = Buffer.from(buf.subarray(coseStart, coseEnd));
  }

  return { rpIdHash, flags, signCount, credentialId, coseKey, coseKeyRaw, aaguid };
}

// ─── Crypto helpers ───────────────────────────────────────────────────────────

function coseToPublicKey(coseKey: Map<Cbor, Cbor>): crypto.KeyObject {
  const kty: number = coseKey.get(1);
  if (kty === 2) {
    // EC2 — P-256 (ES256, alg=-7)
    const x = coseKey.get(-2) as Buffer;
    const y = coseKey.get(-3) as Buffer;
    return crypto.createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: x.toString('base64url'), y: y.toString('base64url') },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      format: 'jwk' as any,
    });
  }
  if (kty === 3) {
    // RSA (RS256, alg=-257)
    const n = coseKey.get(-1) as Buffer;
    const e = coseKey.get(-2) as Buffer;
    return crypto.createPublicKey({
      key: { kty: 'RSA', n: n.toString('base64url'), e: e.toString('base64url') },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      format: 'jwk' as any,
    });
  }
  throw new Error(`Unsupported COSE kty: ${kty}`);
}

function verifySignature(
  authDataBuf: Buffer,
  clientDataJSONBuf: Buffer,
  signature: Buffer,
  alg: number,
  publicKey: crypto.KeyObject,
): boolean {
  // Per WebAuthn spec: verificationData = authData || SHA-256(clientDataJSON)
  const cdHash = crypto.createHash('sha256').update(clientDataJSONBuf).digest();
  const msg = Buffer.concat([authDataBuf, cdHash]);
  // Node.js picks the right ECDSA/RSA algorithm from the key type; we just specify the hash.
  const algo = alg === -7 ? 'SHA256' : 'RSA-SHA256';
  return crypto.createVerify(algo).update(msg).verify(publicKey, signature);
}

function algName(alg: number): string {
  if (alg === -7) return 'ES256';
  if (alg === -257) return 'RS256';
  if (alg === -8) return 'EdDSA';
  return `alg(${alg})`;
}

function fmtAaguid(b: Buffer): string {
  if (b.every((x) => x === 0)) return 'zeroed';
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/passkeys/credentials?userId=…
router.get('/credentials', (req, res) => {
  const userId = String(req.query.userId ?? '');
  const ids = [...(userCredentials.get(userId) ?? [])];
  res.json({
    credentials: ids.map((id) => {
      const c = storedCredentials.get(id)!;
      return {
        id: id.slice(0, 16) + '…',
        alg: algName(c.alg),
        transport: c.transport,
        aaguid: c.aaguid,
        signCount: c.signCount,
        createdAt: c.createdAt,
      };
    }),
  });
});

// DELETE /api/passkeys/credentials?userId=…
router.delete('/credentials', (req, res) => {
  const userId = String(req.query.userId ?? '');
  for (const id of userCredentials.get(userId) ?? []) storedCredentials.delete(id);
  userCredentials.delete(userId);
  res.json({ ok: true });
});

// POST /api/passkeys/challenge
// Body: { type: 'register' | 'authenticate', userId: string }
router.post('/challenge', (req, res) => {
  const { type, userId } = req.body as { type: 'register' | 'authenticate'; userId: string };
  if (!type || !userId?.trim()) return void res.status(400).json({ error: 'type and userId required' });

  const challenge = crypto.randomBytes(32).toString('base64url');
  const sessionId = crypto.randomUUID();
  const rpId = req.hostname;

  pendingChallenges.set(sessionId, {
    value: challenge, type, userId, rpId, expires: Date.now() + 5 * 60_000,
  });

  if (type === 'register') {
    const existingIds = [...(userCredentials.get(userId) ?? [])];
    return void res.json({
      sessionId,
      options: {
        challenge,
        rp: { name: 'PWA Demo', id: rpId },
        user: { id: Buffer.from(userId).toString('base64url'), name: userId, displayName: userId },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
        attestation: 'none',
        timeout: 60_000,
        excludeCredentials: existingIds.map((id) => ({
          id, type: 'public-key', transports: storedCredentials.get(id)?.transport ?? [],
        })),
      },
    });
  }

  const credIds = [...(userCredentials.get(userId) ?? [])];
  res.json({
    sessionId,
    options: {
      challenge,
      rpId,
      allowCredentials: credIds.map((id) => ({
        id, type: 'public-key', transports: storedCredentials.get(id)?.transport ?? [],
      })),
      userVerification: 'preferred',
      timeout: 60_000,
    },
  });
});

// POST /api/passkeys/register
router.post('/register', (req, res) => {
  try {
    const { sessionId, credential } = req.body;

    const stored = pendingChallenges.get(sessionId);
    if (!stored || stored.type !== 'register' || stored.expires < Date.now()) {
      pendingChallenges.delete(sessionId);
      return void res.status(400).json({ error: 'invalid or expired session' });
    }
    pendingChallenges.delete(sessionId);

    // 1. Verify clientDataJSON
    const clientDataJSONBuf = Buffer.from(credential.response.clientDataJSON, 'base64url');
    const clientData = JSON.parse(clientDataJSONBuf.toString('utf8')) as {
      type: string; challenge: string; origin: string;
    };
    if (clientData.type !== 'webauthn.create') {
      return void res.status(400).json({ error: `clientData.type: expected webauthn.create, got ${clientData.type}` });
    }
    if (clientData.challenge !== stored.value) {
      return void res.status(400).json({ error: 'challenge mismatch' });
    }
    const originHostname = new URL(clientData.origin).hostname;
    if (originHostname !== stored.rpId) {
      return void res.status(400).json({ error: `origin mismatch: ${originHostname} ≠ ${stored.rpId}` });
    }

    // 2. Decode attestationObject → authData
    const attObjBuf = Buffer.from(credential.response.attestationObject, 'base64url');
    const [attObj] = decodeCbor(attObjBuf, 0);
    const authDataBuf = (attObj as Map<Cbor, Cbor>).get('authData') as Buffer;
    const authData = parseAuthData(authDataBuf);

    // 3. Verify rpIdHash
    const expectedRpIdHash = crypto.createHash('sha256').update(stored.rpId).digest();
    if (!authData.rpIdHash.equals(expectedRpIdHash)) {
      return void res.status(400).json({ error: 'rpIdHash mismatch' });
    }
    if (!authData.flags.up) {
      return void res.status(400).json({ error: 'user presence flag not set' });
    }
    if (!authData.credentialId || !authData.coseKey || !authData.coseKeyRaw) {
      return void res.status(400).json({ error: 'missing attested credential data' });
    }

    // 4. Store credential
    const alg: number = authData.coseKey.get(3);
    const credId = credential.rawId as string;
    const cred: StoredCredential = {
      id: credId,
      userId: stored.userId,
      publicKeyCose: new Uint8Array(authData.coseKeyRaw),
      alg,
      signCount: authData.signCount,
      transport: (credential.transports as string[] | undefined) ?? [],
      aaguid: authData.aaguid ? fmtAaguid(authData.aaguid) : 'unknown',
      createdAt: Date.now(),
    };
    storedCredentials.set(credId, cred);
    if (!userCredentials.has(stored.userId)) userCredentials.set(stored.userId, new Set());
    userCredentials.get(stored.userId)!.add(credId);

    res.json({
      ok: true,
      credentialId: credId.slice(0, 16) + '…',
      algName: algName(alg),
      alg,
      transport: cred.transport,
      aaguid: cred.aaguid,
      signCount: cred.signCount,
      uvFlag: authData.flags.uv,
      origin: clientData.origin,
      rpId: stored.rpId,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/passkeys/authenticate
router.post('/authenticate', (req, res) => {
  try {
    const { sessionId, credential } = req.body;

    const stored = pendingChallenges.get(sessionId);
    if (!stored || stored.type !== 'authenticate' || stored.expires < Date.now()) {
      pendingChallenges.delete(sessionId);
      return void res.status(400).json({ error: 'invalid or expired session' });
    }
    pendingChallenges.delete(sessionId);

    // 1. Look up credential
    const credId = credential.rawId as string;
    const storedCred = storedCredentials.get(credId);
    if (!storedCred) {
      return void res.status(400).json({ error: 'credential not found — register first' });
    }

    // 2. Verify clientDataJSON
    const clientDataJSONBuf = Buffer.from(credential.response.clientDataJSON, 'base64url');
    const clientData = JSON.parse(clientDataJSONBuf.toString('utf8')) as {
      type: string; challenge: string; origin: string;
    };
    if (clientData.type !== 'webauthn.get') {
      return void res.status(400).json({ error: `clientData.type: expected webauthn.get, got ${clientData.type}` });
    }
    if (clientData.challenge !== stored.value) {
      return void res.status(400).json({ error: 'challenge mismatch' });
    }
    const originHostname = new URL(clientData.origin).hostname;
    if (originHostname !== stored.rpId) {
      return void res.status(400).json({ error: `origin mismatch: ${originHostname} ≠ ${stored.rpId}` });
    }

    // 3. Parse authenticatorData
    const authDataBuf = Buffer.from(credential.response.authenticatorData, 'base64url');
    const authData = parseAuthData(authDataBuf);

    const expectedRpIdHash = crypto.createHash('sha256').update(stored.rpId).digest();
    if (!authData.rpIdHash.equals(expectedRpIdHash)) {
      return void res.status(400).json({ error: 'rpIdHash mismatch' });
    }
    if (!authData.flags.up) {
      return void res.status(400).json({ error: 'user presence flag not set' });
    }

    // 4. Verify signature
    const coseKeyBuf = Buffer.from(storedCred.publicKeyCose);
    const [coseKey] = decodeCbor(coseKeyBuf, 0);
    const publicKey = coseToPublicKey(coseKey as Map<Cbor, Cbor>);
    const signature = Buffer.from(credential.response.signature, 'base64url');
    const valid = verifySignature(authDataBuf, clientDataJSONBuf, signature, storedCred.alg, publicKey);
    if (!valid) {
      return void res.status(400).json({ error: 'signature verification failed' });
    }

    // 5. Sign count check (replay attack detection)
    const newCount = authData.signCount;
    const warning = newCount !== 0 && newCount <= storedCred.signCount
      ? `sign count regression (stored ${storedCred.signCount} → received ${newCount}) — possible cloned authenticator`
      : null;
    storedCred.signCount = newCount;

    res.json({
      ok: true,
      userId: storedCred.userId,
      credentialId: credId.slice(0, 16) + '…',
      signCount: newCount,
      uvFlag: authData.flags.uv,
      algName: algName(storedCred.alg),
      warning,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
