import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { fetchLeetCodeProfile } = await import("@/lib/leetcode-api");

describe("leetcode-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejette pour un username vide", async () => {
    await expect(fetchLeetCodeProfile("")).rejects.toThrow("Nom d'utilisateur");
  });

  it("rejette pour un username après trim vide", async () => {
    await expect(fetchLeetCodeProfile("   ")).rejects.toThrow("Nom d'utilisateur");
  });

  it("rejette si l'API répond avec une erreur", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });
    await expect(fetchLeetCodeProfile("unknown-user")).rejects.toThrow("LeetCode API: 404 Not Found");
  });

  it("rejette si la réponse ne contient pas de username", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });
    await expect(fetchLeetCodeProfile("ghost")).rejects.toThrow("introuvable");
  });

  it("retourne les stats complètes pour un utilisateur valide", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        username: "testuser",
        ranking: 42000,
        streak: 7,
        totalSolved: 150,
        easySolved: 80,
        mediumSolved: 50,
        hardSolved: 20,
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        submissionCalendar: "{}",
        streak: 10,
      }),
    });

    const result = await fetchLeetCodeProfile("testuser");
    expect(result.username).toBe("testuser");
    expect(result.streak).toBe(7); // vient du profil car > 0
    expect(result.totalSolved).toBe(150);
    expect(result.easySolved).toBe(80);
    expect(result.mediumSolved).toBe(50);
    expect(result.hardSolved).toBe(20);
    expect(result.ranking).toBe(42000);
  });

  it("utilise le streak du calendar si le profil a streak=0", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        username: "testuser",
        ranking: 100,
        streak: 0,
        totalSolved: 10,
        easySolved: 5,
        mediumSolved: 3,
        hardSolved: 2,
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        submissionCalendar: "{}",
        streak: 5,
      }),
    });

    const result = await fetchLeetCodeProfile("testuser");
    expect(result.streak).toBe(5);
  });

  it("appelle les bons endpoints API", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ username: "u", ranking: 0, streak: 0, totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0 }),
    });

    await fetchLeetCodeProfile("MyUser");
    const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(urls[0]).toContain("myuser"); // lowercase
    expect(urls[0]).toContain("/myuser");
    expect(urls[1]).toContain("/myuser/calendar");
  });

  it("gère les valeurs manquantes avec fallback à 0", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ username: "u" }),
    });

    const result = await fetchLeetCodeProfile("u");
    expect(result.totalSolved).toBe(0);
    expect(result.easySolved).toBe(0);
    expect(result.streak).toBe(0);
  });
});
