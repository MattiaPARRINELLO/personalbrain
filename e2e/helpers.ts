import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Génère un JWT de session valide compatible avec lib/session-core.ts
// (HS256, header {alg,typ}, payload {sub,iat,exp}, signature HMAC-SHA256).
// Le secret doit être le MÊME que celui du serveur de test : lancer les E2E
// avec AUTH_SECRET défini dans l'environnement (il prime sur .env.local).
export function signSessionToken(sub = "owner", ttlSeconds = 7 * 24 * 3600): string {
  const secret =
    process.env.AUTH_SECRET ||
    "e2e-secret-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const key = /^[0-9a-fA-F]{64}$/.test(secret) ? Buffer.from(secret, "hex") : Buffer.from(secret, "utf-8");

  const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url").replace(/=+$/, "");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub, iat: now, exp: now + ttlSeconds }));
  const signingInput = `${header}.${payload}`;
  const signature = b64url(createHmac("sha256", key).update(signingInput).digest());
  return `${signingInput}.${signature}`;
}

export const STORAGE_STATE_PATH = path.join(__dirname, ".auth", "state.json");

// Écrit le storageState Playwright avec un cookie de session valide.
export function writeStorageState(file: string = STORAGE_STATE_PATH): string {
  const state = {
    cookies: [
      {
        name: "pb_session",
        value: signSessionToken(),
        domain: "localhost",
        path: "/",
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ],
    origins: [],
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
  return file;
}
