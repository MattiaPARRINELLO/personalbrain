import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("./lib/session-edge", () => ({
  SESSION_COOKIE: "pb_session",
  verifyJwt: vi.fn(),
}));

import { proxy } from "./proxy";
import { verifyJwt } from "./lib/session-edge";

function makeRequest(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", `pb_session=${cookie}`);
  return new NextRequest(`http://localhost${path}`, { headers });
}

describe("proxy — deny-by-default", () => {
  beforeEach(() => {
    vi.mocked(verifyJwt).mockResolvedValue({ sub: "owner" });
  });

  it("laisse passer les pages et fichiers publics", async () => {
    const publicPaths = [
      "/",
      "/login",
      "/privacy",
      "/offline",
      "/notif",
      "/sw.js",
      "/manifest.json",
      "/icons/icon-192.png",
    ];
    for (const p of publicPaths) {
      const res = await proxy(makeRequest(p));
      expect(res.status, p).toBe(200);
    }
  });

  it("laisse passer les prefixes API publics", async () => {
    const publicApis = [
      "/api/auth/google",
      "/api/auth/passkey/auth-options",
      "/api/cron/reminders",
      "/api/cron/daily-brief",
      "/api/push",
      "/api/reminders/pending",
    ];
    for (const p of publicApis) {
      const res = await proxy(makeRequest(p));
      expect(res.status, p).toBe(200);
    }
  });

  it("refuse une API protegee sans session en 401 JSON", async () => {
    const res = await proxy(makeRequest("/api/reminders"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Non authentifié");
  });

  it("refuse une API protegee avec un JWT invalide en 401 JSON", async () => {
    vi.mocked(verifyJwt).mockResolvedValue(null);
    const res = await proxy(makeRequest("/api/chat", "token-invalide"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Session invalide");
  });

  it("redirige une page protegee vers /login sans session", async () => {
    const res = await proxy(makeRequest("/reminders"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirige aussi les routes RSC (_next/data/...) d'une page protegee", async () => {
    const res = await proxy(makeRequest("/_next/data/abc123/chat.json"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("autorise une page protegee avec une session valide", async () => {
    const res = await proxy(makeRequest("/reminders", "token-valide"));
    expect(res.status).toBe(200);
  });

  it("ne demande pas le token pour les pages publiques meme avec JWT invalide", async () => {
    vi.mocked(verifyJwt).mockResolvedValue(null);
    const res = await proxy(makeRequest("/login"));
    expect(res.status).toBe(200);
  });
});
