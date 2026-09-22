import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockStorage = {
  getLeetcode: vi.fn(),
  saveLeetcode: vi.fn(),
  addLeetcodeExercise: vi.fn(),
  logActivity: vi.fn(),
  getCalendar: vi.fn(),
};

const mockLeetcodeApi = {
  fetchLeetCodeProfile: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);
vi.mock("@/lib/leetcode-api", () => mockLeetcodeApi);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireSession: vi.fn().mockResolvedValue({ userId: "test-user" }) }));

const { loadLeetcode, saveLeetcodeData, storeExercise, syncLeetcode, getSmartSuggestion, setLeetcodeUsername } = await import("@/app/actions/leetcode");

const SYNCED = {
  username: "testuser",
  streak: 5,
  totalSolved: 10,
  easySolved: 5,
  mediumSolved: 3,
  hardSolved: 2,
  ranking: 5000,
  totalSubmissions: 42,
  submissions: { calendar: { "2026-07-12": 1 }, activeYears: [2026], totalActiveDays: 4 },
};

const stored = (over: Record<string, unknown> = {}) => ({
  exercises: [],
  streak: 0,
  totalSolved: 0,
  easySolved: 0,
  mediumSolved: 0,
  hardSolved: 0,
  ranking: 0,
  leetcodeUsername: "testuser",
  history: [],
  ...over,
});

describe("leetcode actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T09:00:00Z"));
    mockStorage.getLeetcode.mockResolvedValue(stored({ leetcodeUsername: "" }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("loadLeetcode", () => {
    it("retourne les données basiques", async () => {
      const result = await loadLeetcode();
      expect(result.exercises).toEqual([]);
    });

    it("ne synchronise pas sans pseudo configuré", async () => {
      await loadLeetcode();
      expect(mockLeetcodeApi.fetchLeetCodeProfile).not.toHaveBeenCalled();
    });

    it("synchronise quand aucune date de sync n'est connue", async () => {
      mockStorage.getLeetcode.mockResolvedValue(stored());
      mockLeetcodeApi.fetchLeetCodeProfile.mockResolvedValue(SYNCED);

      const result = await loadLeetcode();

      expect(result.streak).toBe(5);
      expect(result.totalSolved).toBe(10);
      expect(result.totalSubmissions).toBe(42);
      expect(mockStorage.saveLeetcode).toHaveBeenCalled();
      expect(mockStorage.saveLeetcode.mock.calls[0][0].syncedAt).toBe("2026-07-12T09:00:00.000Z");
    });

    it("ne resynchronise pas tant que le TTL de 30 min court", async () => {
      mockStorage.getLeetcode.mockResolvedValue(stored({ streak: 3, syncedAt: "2026-07-12T08:50:00.000Z" }));

      const result = await loadLeetcode();

      expect(mockLeetcodeApi.fetchLeetCodeProfile).not.toHaveBeenCalled();
      expect(result.streak).toBe(3);
      expect(result.syncError).toBeUndefined();
    });

    it("resynchronise au-delà de 30 min", async () => {
      mockStorage.getLeetcode.mockResolvedValue(stored({ syncedAt: "2026-07-12T08:00:00.000Z" }));
      mockLeetcodeApi.fetchLeetCodeProfile.mockResolvedValue(SYNCED);

      await loadLeetcode();

      expect(mockLeetcodeApi.fetchLeetCodeProfile).toHaveBeenCalledWith("testuser");
    });

    it("expose l'échec de sync au lieu de le taire", async () => {
      mockStorage.getLeetcode.mockResolvedValue(stored());
      mockLeetcodeApi.fetchLeetCodeProfile.mockRejectedValue(new Error("LeetCode API 502"));

      const result = await loadLeetcode();

      expect(result.streak).toBe(0);
      expect(result.syncError).toBe("LeetCode API 502");
      expect(mockStorage.saveLeetcode).not.toHaveBeenCalled();
    });

    it("ne persiste jamais syncError", async () => {
      mockStorage.getLeetcode.mockResolvedValue(stored({ syncError: "panne d'hier", syncedAt: "2026-07-12T08:50:00.000Z" }));

      const result = await loadLeetcode();

      expect(result.syncError).toBeUndefined();
    });
  });

  describe("saveLeetcodeData", () => {
    it("sauvegarde les données", async () => {
      const data = stored({ streak: 3 });
      await saveLeetcodeData(data);
      expect(mockStorage.saveLeetcode).toHaveBeenCalledWith(data);
    });
  });

  describe("storeExercise", () => {
    it("stocke un exercice et log l'activité", async () => {
      const exercise = { id: "1", title: "Two Sum", difficulty: "Easy" as const, code: "", response: "", createdAt: "" };
      await storeExercise(exercise);
      expect(mockStorage.addLeetcodeExercise).toHaveBeenCalledWith(exercise);
      expect(mockStorage.logActivity).toHaveBeenCalledWith("leetcode_solved", expect.stringContaining("Two Sum"));
    });
  });

  describe("syncLeetcode", () => {
    it("synchronise avec l'API LeetCode et date le sync", async () => {
      mockStorage.getLeetcode.mockResolvedValue(stored());
      mockLeetcodeApi.fetchLeetCodeProfile.mockResolvedValue(SYNCED);

      const result = await syncLeetcode();

      expect(result.streak).toBe(5);
      expect(result.syncedAt).toBe("2026-07-12T09:00:00.000Z");
      expect(mockStorage.saveLeetcode).toHaveBeenCalled();
    });

    it("rejette si aucun username configuré", async () => {
      mockStorage.getLeetcode.mockResolvedValue(stored({ leetcodeUsername: "" }));
      await expect(syncLeetcode()).rejects.toThrow("Aucun username LeetCode configuré");
    });

    it("propage l'erreur de l'API", async () => {
      mockStorage.getLeetcode.mockResolvedValue(stored());
      mockLeetcodeApi.fetchLeetCodeProfile.mockRejectedValue(new Error("Utilisateur LeetCode introuvable"));
      await expect(syncLeetcode()).rejects.toThrow("introuvable");
      expect(mockStorage.saveLeetcode).not.toHaveBeenCalled();
    });
  });

  describe("getSmartSuggestion", () => {
    it("retourne une suggestion pour un créneau disponible", async () => {
      mockStorage.getCalendar.mockResolvedValue([]);
      const suggestion = await getSmartSuggestion();
      expect(typeof suggestion).toBe("string");
      expect(suggestion.length).toBeGreaterThan(10);
    });

    it("contient le nom du créneau et le streak", async () => {
      mockStorage.getCalendar.mockResolvedValue([]);
      mockStorage.getLeetcode.mockResolvedValue(stored({ streak: 3, totalSolved: 10, easySolved: 5, mediumSolved: 3, hardSolved: 2 }));
      const suggestion = await getSmartSuggestion();
      expect(suggestion).toContain("Streak: 3");
      expect(suggestion).toContain("Résolus: 10");
    });

    it("gère l'erreur getCalendar silencieusement en Hard (pas de events)", async () => {
      mockStorage.getCalendar.mockRejectedValue(new Error("Calendar error"));
      const suggestion = await getSmartSuggestion();
      expect(suggestion).toContain("Hard");
    });

    it("retourne Easy quand les events remplissent la journée", async () => {
      const events = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`, title: `Event ${i}`,
        date: `2026-07-12T${String(8 + i).padStart(2, "0")}:00:00`,
        type: "meeting" as const,
      }));
      mockStorage.getCalendar.mockResolvedValue(events);
      const suggestion = await getSmartSuggestion();
      expect(suggestion).toContain("Easy");
    });
  });

  describe("setLeetcodeUsername", () => {
    it("vérifie le pseudo auprès de l'API puis l'enregistre", async () => {
      mockLeetcodeApi.fetchLeetCodeProfile.mockResolvedValue(SYNCED);

      const result = await setLeetcodeUsername("testuser");

      expect(mockLeetcodeApi.fetchLeetCodeProfile).toHaveBeenCalledWith("testuser");
      expect(result.leetcodeUsername).toBe("testuser");
      expect(result.streak).toBe(5);
      expect(mockStorage.saveLeetcode).toHaveBeenCalledWith(
        expect.objectContaining({ leetcodeUsername: "testuser" })
      );
    });

    it("n'enregistre rien si le pseudo est introuvable", async () => {
      mockLeetcodeApi.fetchLeetCodeProfile.mockRejectedValue(
        new Error('Utilisateur LeetCode "ghost" introuvable')
      );

      await expect(setLeetcodeUsername("ghost")).rejects.toThrow("introuvable");
      expect(mockStorage.saveLeetcode).not.toHaveBeenCalled();
    });

    it("rejette si username vide après trim", async () => {
      await expect(setLeetcodeUsername("  ")).rejects.toThrow("Username requis");
    });
  });
});
