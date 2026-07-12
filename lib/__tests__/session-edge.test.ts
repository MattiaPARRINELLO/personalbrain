import { describe, it, expect, beforeAll } from "vitest";

// La signature edge utilise AUTH_SECRET (pas data/.auth-secret)
const TEST_SECRET = "test-secret-thirtytwo-chars-long-for-hmac!!";
process.env.AUTH_SECRET = TEST_SECRET;

const { verifyJwt, SESSION_COOKIE } = await import("@/lib/session-edge");
const { signJwt } = await import("@/lib/session-core");

describe("session-edge", () => {
  it("exporte SESSION_COOKIE", () => {
    expect(SESSION_COOKIE).toBe("pb_session");
  });

  it("verifyJwt rejette un token mal formé", async () => {
    expect(await verifyJwt("not.a.token")).toBeNull();
  });

  it("verifyJwt rejette un token avec 2 parties", async () => {
    expect(await verifyJwt("abc.def")).toBeNull();
  });

  it("verifyJwt valide un token signé par session-core", async () => {
    const payload = { sub: "user123", role: "admin" };
    const token = await signJwt(payload);
    const decoded = await verifyJwt<{ sub: string }>(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe("user123");
  });

  it("verifyJwt rejette un token expiré", async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const payload = { sub: "user123", exp: past };
    const token = await signJwt(payload);
    expect(await verifyJwt(token)).toBeNull();
  });

  it("verifyJwt rejette un token avec signature modifiée", async () => {
    const payload = { sub: "user123" };
    const token = await signJwt(payload);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;
    expect(await verifyJwt(tampered)).toBeNull();
  });

  // Note: impossible de tester "clé différente" car ESM module cache
  // réutilise l'instance. Le test de signature modifiée valide déjà le rejet.
});
