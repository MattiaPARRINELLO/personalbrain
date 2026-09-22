import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { fetchLeetCodeProfile } = await import("@/lib/leetcode-api");

// Charges utiles réelles, relevées sur l'API. Le profil ne contient AUCUN
// compteur : c'est précisément ce qui produisait quatre zéros silencieux avant
// que ces tests ne soient alignés sur la vraie forme des réponses.
const PROFILE = { username: "testuser", name: "Test", ranking: 104124, reputation: 230859 };
const SOLVED = {
  solvedProblem: 682,
  easySolved: 126,
  mediumSolved: 408,
  hardSolved: 148,
  totalSubmissionNum: [{ difficulty: "All", count: 746, submissions: 4931 }],
  acSubmissionNum: [
    { difficulty: "All", count: 682, submissions: 2111 },
    { difficulty: "Easy", count: 126, submissions: 391 },
  ],
};
const CONTEST = {
  contestAttend: 27,
  contestRating: 2204.316,
  contestGlobalRanking: 7531,
  totalParticipants: 883546,
  contestTopPercentage: 0.9,
  contestBadges: { name: "Guardian" },
};

/** Epoch en secondes de minuit UTC, à `offset` jours d'aujourd'hui. */
function dayEpoch(offset: number): number {
  return Math.floor(Date.now() / 86_400_000) * 86_400 - offset * 86_400;
}

function ok(body: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: () => Promise.resolve(body) };
}

function queueReplies({ calendar = "{}", contest = CONTEST }: { calendar?: string; contest?: unknown } = {}) {
  mockFetch
    .mockResolvedValueOnce(ok(PROFILE))
    .mockResolvedValueOnce(ok(SOLVED))
    .mockResolvedValueOnce(ok({ activeYears: [2026], totalActiveDays: 49, submissionCalendar: calendar }))
    .mockResolvedValueOnce(ok(contest));
}

describe("leetcode-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejette pour un username vide", async () => {
    await expect(fetchLeetCodeProfile("")).rejects.toThrow("Nom d'utilisateur");
    await expect(fetchLeetCodeProfile("   ")).rejects.toThrow("Nom d'utilisateur");
  });

  it("rejette si l'API répond avec un statut HTTP en erreur", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502, statusText: "Bad Gateway" });
    await expect(fetchLeetCodeProfile("testuser")).rejects.toThrow("LeetCode API 502");
  });

  it("rejette un utilisateur inconnu annoncé en HTTP 200 avec un tableau errors", async () => {
    // Comportement réel de l'API : pas de 404, mais `errors` dans le corps.
    mockFetch.mockResolvedValue(
      ok({ errors: [{ message: "That user does not exist." }], data: { allQuestionsCount: [] } })
    );
    await expect(fetchLeetCodeProfile("ghost")).rejects.toThrow('Utilisateur LeetCode "ghost" introuvable');
  });

  it("lit les compteurs sur /solved, pas sur le profil", async () => {
    queueReplies();
    const result = await fetchLeetCodeProfile("testuser");
    expect(result.totalSolved).toBe(682);
    expect(result.easySolved).toBe(126);
    expect(result.mediumSolved).toBe(408);
    expect(result.hardSolved).toBe(148);
    expect(result.ranking).toBe(104124);
  });

  it("calcule la série depuis le calendrier au lieu de lire le champ streak", async () => {
    queueReplies({
      calendar: JSON.stringify({ [dayEpoch(0)]: 2, [dayEpoch(1)]: 1, [dayEpoch(2)]: 3 }),
    });
    const result = await fetchLeetCodeProfile("testuser");
    expect(result.streak).toBe(3);
  });

  it("retient la série vivante quand seule la veille est active", async () => {
    queueReplies({ calendar: JSON.stringify({ [dayEpoch(1)]: 1, [dayEpoch(2)]: 1 }) });
    const result = await fetchLeetCodeProfile("testuser");
    expect(result.streak).toBe(2);
  });

  it("compte les soumissions acceptées depuis acSubmissionNum", async () => {
    queueReplies();
    const result = await fetchLeetCodeProfile("testuser");
    expect(result.totalSubmissions).toBe(2111);
  });

  it("normalise le calendrier en jours UTC et garde les jours actifs", async () => {
    queueReplies({ calendar: JSON.stringify({ [dayEpoch(0)]: 5 }) });
    const result = await fetchLeetCodeProfile("testuser");
    expect(result.submissions.activeYears).toEqual([2026]);
    expect(result.submissions.totalActiveDays).toBe(49);
    expect(Object.values(result.submissions.calendar)).toEqual([5]);
  });

  it("expose le contest quand le compte en a un", async () => {
    queueReplies();
    const result = await fetchLeetCodeProfile("testuser");
    expect(result.contest).toEqual({
      attended: 27,
      rating: 2204,
      globalRanking: 7531,
      topPercentage: 0.9,
      badge: "Guardian",
    });
  });

  it("omet le contest quand le compte n'en a aucun", async () => {
    queueReplies({ contest: { contestParticipation: [] } });
    const result = await fetchLeetCodeProfile("testuser");
    expect(result.contest).toBeUndefined();
  });

  it("n'échoue pas si l'endpoint contest est indisponible", async () => {
    mockFetch
      .mockResolvedValueOnce(ok(PROFILE))
      .mockResolvedValueOnce(ok(SOLVED))
      .mockResolvedValueOnce(ok({ submissionCalendar: "{}" }))
      .mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchLeetCodeProfile("testuser");
    expect(result.totalSolved).toBe(682);
    expect(result.contest).toBeUndefined();
  });

  it("appelle les quatre endpoints, en minuscules", async () => {
    queueReplies();
    await fetchLeetCodeProfile("MyUser");
    const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(urls).toHaveLength(4);
    expect(urls[0]).toContain("/myuser");
    expect(urls[1]).toContain("/myuser/solved");
    expect(urls[2]).toContain("/myuser/calendar");
    expect(urls[3]).toContain("/myuser/contest");
  });

  it("retombe à zéro sur des champs manquants", async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ username: "u" }))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({}));
    const result = await fetchLeetCodeProfile("u");
    expect(result.totalSolved).toBe(0);
    expect(result.easySolved).toBe(0);
    expect(result.streak).toBe(0);
    expect(result.totalSubmissions).toBe(0);
    expect(result.ranking).toBe(0);
  });
});
