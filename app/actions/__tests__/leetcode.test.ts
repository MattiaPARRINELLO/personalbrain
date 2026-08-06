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

describe("leetcode actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T09:00:00Z"));
    mockStorage.getLeetcode.mockResolvedValue({ exercises: [], streak: 0, totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0, ranking: 0, leetcodeUsername: "", history: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("loadLeetcode", () => {
    it("retourne les données basiques", async () => {
      const result = await loadLeetcode();
      expect(result.exercises).toEqual([]);
    });

    it("auto-sync si username configuré et streak === 0", async () => {
      mockStorage.getLeetcode.mockResolvedValue({ exercises: [], streak: 0, totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0, ranking: 0, leetcodeUsername: "testuser", history: [] });
      mockLeetcodeApi.fetchLeetCodeProfile.mockResolvedValue({ username: "testuser", streak: 5, totalSolved: 10, easySolved: 5, mediumSolved: 3, hardSolved: 2, ranking: 5000 });

      const result = await loadLeetcode();

      expect(result.streak).toBe(5);
      expect(mockStorage.saveLeetcode).toHaveBeenCalled();
    });

    it("ne tente pas l'auto-sync si streak > 0", async () => {
      mockStorage.getLeetcode.mockResolvedValue({ exercises: [], streak: 3, totalSolved: 10, easySolved: 5, mediumSolved: 3, hardSolved: 2, ranking: 5000, leetcodeUsername: "testuser", history: [] });
      await loadLeetcode();
      expect(mockLeetcodeApi.fetchLeetCodeProfile).not.toHaveBeenCalled();
    });

    it("retourne les données silencieusement si l'auto-sync échoue", async () => {
      mockStorage.getLeetcode.mockResolvedValue({ exercises: [], streak: 0, totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0, ranking: 0, leetcodeUsername: "testuser", history: [] });
      mockLeetcodeApi.fetchLeetCodeProfile.mockRejectedValue(new Error("Network error"));
      const result = await loadLeetcode();
      expect(result.streak).toBe(0);
    });
  });

  describe("saveLeetcodeData", () => {
    it("sauvegarde les données", async () => {
      const data = { exercises: [], streak: 3, totalSolved: 10, easySolved: 5, mediumSolved: 3, hardSolved: 2, ranking: 5000, leetcodeUsername: "testuser", history: [] };
      await saveLeetcodeData(data);
      expect(mockStorage.saveLeetcode).toHaveBeenCalledWith(data);
    });
  });

  describe("storeExercise", () => {
    it("stocke un exercice et log l'activité", async () => {
      const exercise = { id: "1", title: "Two Sum", difficulty: "Easy" as const, date: "2025-01-01", code: "", response: "", createdAt: "" };
      await storeExercise(exercise);
      expect(mockStorage.addLeetcodeExercise).toHaveBeenCalledWith(exercise);
      expect(mockStorage.logActivity).toHaveBeenCalledWith("leetcode_solved", expect.stringContaining("Two Sum"));
    });
  });

  describe("syncLeetcode", () => {
    it("synchronise avec l'API LeetCode", async () => {
      mockStorage.getLeetcode.mockResolvedValue({ exercises: [], streak: 0, totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0, ranking: 0, leetcodeUsername: "testuser", history: [] });
      mockLeetcodeApi.fetchLeetCodeProfile.mockResolvedValue({ username: "testuser", streak: 5, totalSolved: 10, easySolved: 5, mediumSolved: 3, hardSolved: 2, ranking: 5000 });
      const result = await syncLeetcode();
      expect(result.streak).toBe(5);
      expect(mockStorage.saveLeetcode).toHaveBeenCalled();
    });

    it("rejette si aucun username configuré", async () => {
      await expect(syncLeetcode()).rejects.toThrow("Aucun username LeetCode configuré");
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
      mockStorage.getLeetcode.mockResolvedValue({ exercises: [], streak: 3, totalSolved: 10, easySolved: 5, mediumSolved: 3, hardSolved: 2, ranking: 5000, leetcodeUsername: "testuser", history: [] });
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
    it("enregistre le username", async () => {
      mockStorage.getLeetcode.mockResolvedValue({ exercises: [], streak: 0, totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0, ranking: 0, leetcodeUsername: "", history: [] });
      mockLeetcodeApi.fetchLeetCodeProfile.mockResolvedValue({ username: "testuser", streak: 5, totalSolved: 10, easySolved: 5, mediumSolved: 3, hardSolved: 2, ranking: 5000 });
      await setLeetcodeUsername("testuser");
      expect(mockStorage.saveLeetcode).toHaveBeenCalledWith(expect.objectContaining({ leetcodeUsername: "testuser" }));
    });

    it("rejette si username vide après trim", async () => {
      await expect(setLeetcodeUsername("  ")).rejects.toThrow("Username requis");
    });
  });
});
