const SESSION_COOKIE = "pb_session";

let cachedKey: CryptoKey | null = null;

// Décode la valeur hex (openssl rand -hex 32) en bytes ; sinon raw.
// Doit rester identique à lib/session-core.ts pour que les sessions soient
// valides des deux côtés (edge et node).
function secretBytes(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Uint8Array.from(Buffer.from(trimmed, "hex"));
  }
  return Uint8Array.from(new TextEncoder().encode(secret));
}

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  if (!process.env.AUTH_SECRET) {
    throw new Error(
      "AUTH_SECRET non configuré. Définissez-le dans .env.local"
    );
  }

  const secret = secretBytes(process.env.AUTH_SECRET);
  cachedKey = await crypto.subtle.importKey(
    "raw",
    secret as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return cachedKey;
}

function base64UrlDecode(input: string): Uint8Array {
  const padding = "=".repeat((4 - (input.length % 4)) % 4);
  return new Uint8Array(Buffer.from(input + padding, "base64url"));
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

export { SESSION_COOKIE };
