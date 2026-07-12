import { describe, it, expect, beforeEach, vi } from "vitest";
import { signJwt, verifyJwt } from "@/lib/session-core";

// Configurer un secret pour les tests
process.env.AUTH_SECRET = "test-secret-thirtytwo-chars-long-for-hmac!!";

describe("session-core", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-thirtytwo-chars-long-for-hmac!!";
  });

  it("signe et vérifie un JWT valide", async () => {
    const payload = { sub: "user123", role: "admin" };
    const token = await signJwt(payload);
    expect(token).toBeDefined();
    expect(token.split(".")).toHaveLength(3);

    const decoded = await verifyJwt<typeof payload>(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe("user123");
    expect(decoded!.role).toBe("admin");
  });

  it("signe un JWT avec expiration et la vérifie", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const payload = { sub: "user123", exp: future };
    const token = await signJwt(payload);
    const decoded = await verifyJwt<{ sub: string }>(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe("user123");
  });

  it("rejette un token expiré", async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const payload = { sub: "user123", exp: past };
    const token = await signJwt(payload);
    const decoded = await verifyJwt(token);
    expect(decoded).toBeNull();
  });

  it("rejette un token invalide", async () => {
    const decoded = await verifyJwt("invalid.token.format");
    expect(decoded).toBeNull();
  });

  it("rejette un token avec signature modifiée", async () => {
    const payload = { sub: "user123" };
    const token = await signJwt(payload);
    const parts = token.split(".");
    const tampered = parts[0] + "." + parts[1] + ".invalidsignature";
    const decoded = await verifyJwt(tampered);
    expect(decoded).toBeNull();
  });

  it("rejette un token avec payload invalide", async () => {
    // payload "AAAA" décode en octets nuls → JSON.parse échoue → catch retourne null
    const decoded = await verifyJwt("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.AAAA.dGVzdA");
    expect(decoded).toBeNull();
  });

  it("rejette un token dont la signature est invalide pour HMAC", async () => {
    // crypto.subtle.verify lance pour une signature trop courte → catch retourne null
    const payload = { sub: "test" };
    const token = await signJwt(payload);
    const parts = token.split(".");
    // signature d'1 seul caractère = 1 octet → HMAC-SHA256 requiert 32 octets
    const shortSig = Buffer.from([0]).toString("base64url");
    const decoded = await verifyJwt(`${parts[0]}.${parts[1]}.${shortSig}`);
    expect(decoded).toBeNull();
  });

  it("utilise AUTH_SECRET depuis le fichier si variable d'env absente", async () => {
    const original = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    const fs = await import("fs");
    const path = await import("path");
    const secretPath = path.join(process.cwd(), "data", ".auth-secret");
    fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
    fs.writeFileSync(secretPath, Buffer.from("test-secret-thirtytwo-chars-long-for-hmac!!").toString("hex"));
    const mod = await import("@/lib/session-core");
    const token = await mod.signJwt({ sub: "file-test" });
    expect(token.split(".")).toHaveLength(3);
    const decoded = await mod.verifyJwt<{ sub: string }>(token);
    expect(decoded?.sub).toBe("file-test");
    process.env.AUTH_SECRET = original;
  });
});
