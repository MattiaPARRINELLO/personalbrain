import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt } from "@/lib/session-core";

// Configurer un secret pour les tests
process.env.AUTH_SECRET = "test-secret-thirtytwo-chars-long-for-hmac!!";

describe("session-core", () => {
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
});
