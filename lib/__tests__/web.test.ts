import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// isSafeFetchUrl fait un lookup DNS réel : mocké pour des tests déterministes.
vi.mock("dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

const { isSafeFetchUrl, safeFetchText, MAX_FETCH_BYTES } = await import("@/lib/web");

describe("isSafeFetchUrl — anti-SSRF", () => {
  it("refuse les hôtes et IP privés / réservés", async () => {
    const blocked = [
      "http://localhost:3000/x",
      "https://localhost/x",
      "http://127.0.0.1/x",
      "http://10.0.0.5/x",
      "http://192.168.1.10/x",
      "http://169.254.169.254/latest/meta-data/",
      "http://172.16.0.1/x",
      "http://172.31.255.255/x",
      "http://0.0.0.0/x",
      "http://[::1]/x",
      "http://[fe80::1]/x",
      "http://[fc00::1]/x",
      "http://[fd00::1]/x",
    ];
    for (const url of blocked) {
      expect(await isSafeFetchUrl(url), url).toBe(false);
    }
  });

  it("refuse les formes d'IP exotiques (décimal, octal, hexa, IPv4-mapped)", async () => {
    const blocked = [
      "http://2130706433/x", // 127.0.0.1 en décimal
      "http://0177.0.0.1/x", // 127.0.0.1 en octal
      "http://0x7f.0.0.1/x", // 127.0.0.1 en hexa
      "http://0x7f000001/x", // 127.0.0.1 en hexa 32 bits
      "http://[::ffff:127.0.0.1]/x", // IPv4-mapped
      "http://[::127.0.0.1]/x", // IPv4-compatible
      "http://2852039166/x", // 169.254.169.254 en décimal
    ];
    for (const url of blocked) {
      expect(await isSafeFetchUrl(url), url).toBe(false);
    }
  });

  it("refuse les protocoles non http(s)", async () => {
    expect(await isSafeFetchUrl("file:///etc/passwd")).toBe(false);
    expect(await isSafeFetchUrl("ftp://example.com/x")).toBe(false);
    expect(await isSafeFetchUrl("javascript:alert(1)")).toBe(false);
  });

  it("accepte une IP publique et un hostname public (DNS mocké)", async () => {
    expect(await isSafeFetchUrl("http://93.184.216.34/x")).toBe(true);
    expect(await isSafeFetchUrl("https://example.com/x")).toBe(true);
  });
});

describe("safeFetchText — fetch serveur sûr", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuse une URL privée avant tout fetch", async () => {
    await expect(safeFetchText("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      "URL non autorisée"
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuse une redirection vers une IP privée (anti redirect SSRF)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: new Headers({ location: "http://169.254.169.254/latest/meta-data/" }),
    } as unknown as Response);
    await expect(safeFetchText("https://example.com/a")).rejects.toThrow(
      "Redirection vers une URL non autorisée"
    );
    // Le premier fetch a été fait, pas de second vers l'IP privée.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("suit une redirection publique en re-vérifiant chaque saut", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({ location: "https://example.com/final" }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "<html>final</html>",
      } as unknown as Response);
    const text = await safeFetchText("https://example.com/a");
    expect(text).toContain("final");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("abandonne après trop de redirections", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 302,
      headers: new Headers({ location: "https://example.com/loop" }),
    } as unknown as Response);
    await expect(safeFetchText("https://example.com/a")).rejects.toThrow("Trop de redirections");
  });

  it("limite la taille du corps lu (anti OOM)", async () => {
    const big = new Uint8Array(MAX_FETCH_BYTES + 1);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(big);
          controller.close();
        },
      }),
    } as unknown as Response);
    await expect(safeFetchText("https://example.com/a")).rejects.toThrow("Réponse trop volumineuse");
  });

  it("lève une erreur HTTP claire", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    await expect(safeFetchText("https://example.com/404")).rejects.toThrow("HTTP 404");
  });
});
