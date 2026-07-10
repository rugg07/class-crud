// Minimal Web Crypto HMAC-SHA256 JWT implementation
// Edge-compatible (no Node.js crypto dependency), satisfies SPECS.md "roll your own JWT"
// Used for the dev-only login stand-in; will be replaced by real Fastify OAuth+session backend

export interface JwtPayload {
  sub: string; // user id
  role: 'admin' | 'teacher' | 'student';
  name: string;
  iat: number; // issued at
  exp: number; // expiration
}

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ALGORITHM = 'HS256';
const EXP_HOURS = 24;

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.padEnd(str.length + (4 - (str.length % 4)) % 4, '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + EXP_HOURS * 3600,
  };

  const header = { alg: ALGORITHM, typ: 'JWT' };
  const encoder = new TextEncoder();
  const headerEncoded = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadEncoded = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  const key = await getKey();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signatureInput)
  );
  const signatureEncoded = base64UrlEncode(signature);

  return `${signatureInput}.${signatureEncoded}`;
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const headerEncoded = parts[0];
    const payloadEncoded = parts[1];
    const signatureEncoded = parts[2];

    if (!headerEncoded || !payloadEncoded || !signatureEncoded) return null;

    const signatureInput = `${headerEncoded}.${payloadEncoded}`;

    const key = await getKey();
    const signatureBytes = base64UrlDecode(signatureEncoded);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as BufferSource,
      new TextEncoder().encode(signatureInput)
    );

    if (!isValid) return null;

    const payloadBytes = base64UrlDecode(payloadEncoded);
    const payloadText = new TextDecoder().decode(payloadBytes);
    const payload: JwtPayload = JSON.parse(payloadText);

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
