/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function mockFetch(result: { ok?: boolean; data?: unknown; status?: number }) {
  const { ok = true, data = { test: "ok" }, status = 200 } = result;
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  });
}

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

  it("offlineFetch réussit et met en cache", async () => {
    const fetch = mockFetch({});
    vi.stubGlobal("fetch", fetch);
    const { offlineFetch } = await import("@/lib/offline");
    const result = await offlineFetch("/api/test");
    expect(result).toEqual({ test: "ok" });
    expect(localStorage.getItem("brain-cache:/api/test")).not.toBeNull();
  });

  it("offlineFetch utilise le cache en cas d'échec réseau", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetch);
    localStorage.setItem(
      "brain-cache:/api/test",
      JSON.stringify({ data: { cached: "yes" }, ts: Date.now() })
    );
    const { offlineFetch } = await import("@/lib/offline");
    const result = await offlineFetch("/api/test");
    expect(result).toEqual({ cached: "yes" });
  });

  it("offlineFetch relance l'erreur si pas de cache", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetch);
    const { offlineFetch } = await import("@/lib/offline");
    await expect(offlineFetch("/api/test")).rejects.toThrow("Network error");
  });

  it("offlineFetch rejette si HTTP non-ok", async () => {
    const fetch = mockFetch({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetch);
    const { offlineFetch } = await import("@/lib/offline");
    await expect(offlineFetch("/api/test")).rejects.toThrow("HTTP 500");
  });

  it("offlineFetch ne plante pas si localStorage.setItem échoue", async () => {
    const setItem = vi.fn().mockImplementation(() => { throw new Error("Quota exceeded"); });
    vi.stubGlobal("localStorage", { setItem });
    const fetch = mockFetch({});
    vi.stubGlobal("fetch", fetch);
    const { offlineFetch } = await import("@/lib/offline");
    const result = await offlineFetch("/api/test");
    expect(result).toEqual({ test: "ok" });
  });
});
