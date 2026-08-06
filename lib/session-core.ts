import { promises as fs } from "fs";
import path from "path";

export const SESSION_COOKIE = "pb_session";
export const CHALLENGE_COOKIE = "pb_challenge";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const CHALLENGE_TTL_SECONDS = 5 * 60;

const SECRET_FILE = path.join(process.cwd(), "data", ".auth-secret");

// Décode la valeur hex (openssl rand -hex 32) en bytes ; sinon raw.
// Garantit que AUTH_SECRET et data/.auth-secret produisent la MÊME clé
// pour une même valeur (sinon les sessions signées en local ne sont pas
// valides côté serveur et inversement).
function secretBytes(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Uint8Array.from(Buffer.from(trimmed, "hex"));
  }
  return Uint8Array.from(new TextEncoder().encode(secret));
}

async function getSecret(): Promise<Uint8Array> {
  if (process.env.AUTH_SECRET) {
    return secretBytes(process.env.AUTH_SECRET);
  }

  try {
    const existing = await fs.readFile(SECRET_FILE, "utf-8");
    return Uint8Array.from(Buffer.from(existing, "hex"));
  } catch {
    throw new Error(
      "AUTH_SECRET non configuré. Générez une clé avec : openssl rand -hex 32 " +
      "et définissez-la dans .env.local ou data/.auth-secret"
    );
  }
}

async function getSigningKey(): Promise<CryptoKey> {
  const secret = await getSecret();
  return crypto.subtle.importKey(
    "raw",
    secret as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  return Buffer.from(buffer)
    .toString("base64url")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Uint8Array {
  const padding = "=".repeat((4 - (input.length % 4)) % 4);
  return new Uint8Array(Buffer.from(input + padding, "base64url"));
}

export async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)).buffer);
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)).buffer);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput) as unknown as BufferSource
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function verifyJwt<T extends Record<string, unknown>>(token: string): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  try {
    const key = await getSigningKey();
    const signatureBytes = base64UrlDecode(encodedSignature);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes.buffer.slice(
        signatureBytes.byteOffset,
        signatureBytes.byteOffset + signatureBytes.byteLength
      ) as ArrayBuffer,
      new TextEncoder().encode(signingInput) as unknown as BufferSource
    );
    if (!valid) return null;

    const payloadBytes = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as T & { exp?: number };
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
