/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

async function getModule() {
  return import("@/lib/capacitor");
}

describe("capacitor (browser)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("isCapacitor retourne false sans Capacitor global", async () => {
    const mod = await getModule();
    expect(mod.isCapacitor()).toBe(false);
  });

  it("isCapacitor retourne true avec Capacitor global", async () => {
    vi.stubGlobal("Capacitor", {});
    const mod = await getModule();
    expect(mod.isCapacitor()).toBe(true);
  });

  it("isNative retourne true quand Capacitor est présent", async () => {
    vi.stubGlobal("Capacitor", {});
    const mod = await getModule();
    expect(mod.isNative()).toBe(true);
  });

  it("isWebAuthnSupported retourne true si PublicKeyCredential existe", async () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    const mod = await getModule();
    expect(mod.isWebAuthnSupported()).toBe(true);
  });

  it("isWebAuthnSupported retourne false si PublicKeyCredential est undefined", async () => {
    vi.stubGlobal("PublicKeyCredential", undefined);
    const mod = await getModule();
    expect(mod.isWebAuthnSupported()).toBe(false);
  });
});
