/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Re-import après chaque modification de window
async function getCapacitorModule() {
  return import("@/lib/capacitor");
}

describe("capacitor (node)", () => {
  it("isCapacitor retourne false côté serveur", async () => {
    const mod = await getCapacitorModule();
    expect(mod.isCapacitor()).toBe(false);
  });

  it("isNative retourne false côté serveur", async () => {
    const mod = await getCapacitorModule();
    expect(mod.isNative()).toBe(false);
  });

  it("isWebAuthnSupported retourne false côté serveur", async () => {
    const mod = await getCapacitorModule();
    expect(mod.isWebAuthnSupported()).toBe(false);
  });
});
