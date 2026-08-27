/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("offline (node)", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
      get length() { return Object.keys(store).length; },
      clear: vi.fn(() => { for (const k in store) delete store[k]; }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clearOfflineCache ne lance pas d'erreur", async () => {
    const { clearOfflineCache } = await import("@/lib/offline");
    expect(() => clearOfflineCache()).not.toThrow();
  });

  it("clearOfflineCache ne supprime que les clés préfixées", async () => {
    localStorage.setItem("brain-cache:/api/test", "data");
    localStorage.setItem("other-key", "keep");
    const { clearOfflineCache } = await import("@/lib/offline");
    clearOfflineCache();
    expect(localStorage.getItem("brain-cache:/api/test")).toBeNull();
    expect(localStorage.getItem("other-key")).toBe("keep");
  });
});
