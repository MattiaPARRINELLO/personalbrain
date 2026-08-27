import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

vi.mock("@/lib/ai-providers", () => ({
  chatCompletion: vi.fn(),
}));
vi.mock("@/lib/config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    models: { generalAlt: "deepseek-v4-flash" },
    llm: { temperature: 0, maxTokens: 128 },
  }),
}));
// isSafeFetchUrl fait un lookup DNS réel : mocké pour garder les tests
// déterministes et hors réseau.
vi.mock("dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

import { chatCompletion } from "@/lib/ai-providers";

const TEST_DIR = path.join(os.tmpdir(), "backstage-test-domains-" + Date.now());
const originalCwd = process.cwd;

beforeEach(() => {
  process.cwd = () => TEST_DIR;
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, "data"), { recursive: true });
});

afterEach(() => {
  process.cwd = originalCwd;
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

async function getStorage() {
  return import("@/lib/storage");
}

describe("storage - memory", () => {
  it("retourne la mémoire par défaut", async () => {
    const storage = await getStorage();
    const data = await storage.getMemory();
    // La mémoire a des données par défaut : 2 faits + profile
    expect(data.facts.length).toBeGreaterThanOrEqual(2);
    expect(data.profile.name).toBe("Mattia");
  });

  it("ajoute un fait mémoire", async () => {
    const storage = await getStorage();
    const fact = await storage.addMemoryFact("J'aime le café", "preference");
    expect(fact.content).toBe("J'aime le café");
    expect(fact.category).toBe("preference");

    const data = await storage.getMemory();
    // 2 faits par défaut + 1 nouveau
    expect(data.facts).toHaveLength(3);
  });

  it("modifie un fait mémoire", async () => {
    const storage = await getStorage();
    const fact = await storage.addMemoryFact("Old content", "dev");
    const updated = await storage.updateMemoryFact(fact.id, { content: "New content", category: "life" });
    expect(updated).not.toBeNull();
    expect(updated!.content).toBe("New content");
    expect(updated!.category).toBe("life");
  });

  it("retourne null si on modifie un fait inexistant", async () => {
    const storage = await getStorage();
    const updated = await storage.updateMemoryFact("nonexistent", { content: "test" });
    expect(updated).toBeNull();
  });

  it("touchMemoryFact incrémente accessCount", async () => {
    const storage = await getStorage();
    const fact = await storage.addMemoryFact("Test", "life");
    await storage.touchMemoryFact(fact.id);
    const data = await storage.getMemory();
    const touched = data.facts.find((f: { id: string }) => f.id === fact.id);
    expect(touched?.accessCount).toBe(1);
  });

  it("findSimilarMemoryFacts utilise l'IA puis fallback exact", async () => {
    const storage = await getStorage();
    // Le fait par défaut existe : "Prefere coder en TypeScript"
    const found = await storage.findSimilarMemoryFacts("Prefere coder en TypeScript", "dev");
    expect(found).not.toBeNull();
    expect(found!.category).toBe("dev");
  });

  it("findSimilarMemoryFacts retourne null si pas de correspondance exacte", async () => {
    const storage = await getStorage();
    // Le fallback exact ne trouve rien
    const found = await storage.findSimilarMemoryFacts("texte inexistant", "dev");
    expect(found).toBeNull();
  });

  it("findSimilarMemoryFacts trouve par similarité sémantique via IA", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce({ content: "1", toolCalls: [] });
    const storage = await getStorage();
    // Le fait 1 par défaut : "Prefere coder en TypeScript"
    const found = await storage.findSimilarMemoryFacts("J'adore développer en TypeScript", "dev");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("1");
  });

  it("deleteMemoryFact supprime un fait", async () => {
    const storage = await getStorage();
    const fact = await storage.addMemoryFact("À supprimer", "life");
    const deleted = await storage.deleteMemoryFact(fact.id);
    expect(deleted).toBe(true);
    const data = await storage.getMemory();
    expect(data.facts.find((f: { id: string }) => f.id === fact.id)).toBeUndefined();
  });

  it("deleteMemoryFact retourne false si inexistant", async () => {
    const storage = await getStorage();
    expect(await storage.deleteMemoryFact("nope")).toBe(false);
  });
});

describe("storage - watch later", () => {
  it("ajoute, liste et supprime des items", async () => {
    const storage = await getStorage();
    const item = await storage.addWatchLaterItem({
      url: "https://example.com",
      title: "Test Article",
      category: "article",
    });
    expect(item.title).toBe("Test Article");
    expect(item.category).toBe("article");

    expect(item.read).toBe(false);

    const data = await storage.getWatchLater();
    expect(data.items).toHaveLength(1);

    const deleted = await storage.deleteWatchLaterItem(item.id);
    expect(deleted).toBe(true);
    const data2 = await storage.getWatchLater();
    expect(data2.items).toHaveLength(0);
  });

  it("met à jour un item watch later", async () => {
    const storage = await getStorage();
    const item = await storage.addWatchLaterItem({
      url: "https://example.com",
      title: "Original",
      category: "video",
    });
    const updated = await storage.updateWatchLaterItem(item.id, {
      title: "Updated",
      summary: "Résumé",
      aiTags: ["tag1", "tag2"],
    });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("Updated");
    expect(updated!.summary).toBe("Résumé");
    expect(updated!.aiTags).toEqual(["tag1", "tag2"]);
  });

  it("reorderWatchLaterItems réordonne les items", async () => {
    const storage = await getStorage();
    const a = await storage.addWatchLaterItem({ url: "https://a.com", title: "A", category: "article" });
    const b = await storage.addWatchLaterItem({ url: "https://b.com", title: "B", category: "video" });
    const ok = await storage.reorderWatchLaterItems([a.id, b.id]);
    expect(ok).toBe(true);
  });
});

describe("storage - leetcode", () => {
  it("retourne leetcode vide par défaut", async () => {
    const storage = await getStorage();
    const data = await storage.getLeetcode();
    expect(data.exercises).toEqual([]);
  });

  it("ajoute un exercice leetcode", async () => {
    const storage = await getStorage();
    await storage.addLeetcodeExercise({
      id: "1",
      title: "Two Sum",
      difficulty: "Easy",
      code: "def two_sum(): pass",
      response: "OK",
      createdAt: "2026-01-01",
    });
    const data = await storage.getLeetcode();
    expect(data.exercises).toHaveLength(1);
    expect(data.exercises[0].title).toBe("Two Sum");
  });
});

describe("storage - calendar", () => {
  it("getCalendar retourne les concerts par défaut", async () => {
    const storage = await getStorage();
    const events = await storage.getCalendar();
    // getCalendar mappe les concerts, il y en a 8 par défaut
    expect(events.length).toBeGreaterThanOrEqual(8);
    expect(events[0].type).toBe("concert");
  });

  it("addCalendarEvent avec type meeting et getCalendar le retrouve", async () => {
    const storage = await getStorage();
    const evt = await storage.addCalendarEvent({
      title: "Meeting test",
      date: "2026-07-15T10:00:00Z",
      type: "meeting",
    });
    expect(evt.title).toBe("Meeting test");
    expect(evt.id).toBeDefined();

    const events = await storage.getCalendar();
    const found = events.find((e: { id: string }) => e.id === evt.id);
    expect(found).toBeDefined();
    expect(found!.type).toBe("meeting");
  });

  it("addCalendarEvent avec type concert ajoute un concert", async () => {
    const storage = await getStorage();
    const evt = await storage.addCalendarEvent({
      title: "Concert : Nouvel Artiste",
      date: "2026-08-01",
      venue: "Salle Pleyel",
      type: "concert",
    });
    expect(evt.title).toBe("Concert : Nouvel Artiste");

    const concerts = await storage.getConcerts();
    expect(concerts.events.some((c: { artist: string }) => c.artist === "Nouvel Artiste")).toBe(true);
  });
});

describe("storage - emails", () => {
  it("searchEmails cherche par contenu", async () => {
    const storage = await getStorage();
    // Emails par défaut : "Shooting samedi" de Faustine
    const results = await storage.searchEmails("shooting");
    expect(results).toHaveLength(1);
    expect(results[0].from).toContain("Faustine");
  });
});

describe("storage - activity", () => {
  it("logActivity crée une entrée et getActivity la retourne", async () => {
    const storage = await getStorage();
    await storage.logActivity("reminder_created", "Test activity", "detail123");
    const entries = await storage.getActivity(10);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].action).toBe("reminder_created");
    expect(entries[0].label).toBe("Test activity");
  });
});

describe("storage - accreditations", () => {
  it("CRUD accreditations", async () => {
    const storage = await getStorage();
    const acc = await storage.addAccreditation({
      artist: "Artist A",
      venue: "Venue A",
      concertDate: "2026-08-01",
      contactEmail: "manager@test.com",
    });
    expect(acc.artist).toBe("Artist A");

    const updated = await storage.updateAccreditation(acc.id, { status: "accepted" });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("accepted");

    const found = await storage.searchAccreditations("Artist");
    expect(found.length).toBeGreaterThan(0);

    const deleted = await storage.deleteAccreditation(acc.id);
    expect(deleted).toBe(true);
  });
});

describe("storage - photo shoots", () => {
  it("CRUD photo shoots", async () => {
    const storage = await getStorage();
    const shoot = await storage.addPhotoShoot({
      title: "Mariage Martin",
      date: "2099-09-15",
      client: "Martin",
    });
    expect(shoot.title).toBe("Mariage Martin");
    expect(shoot.status).toBe("upcoming");

    const updated = await storage.updatePhotoShoot(shoot.id, { status: "done" });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("done");

    const deleted = await storage.deletePhotoShoot(shoot.id);
    expect(deleted).toBe(true);
  });

  it("addPhotoShoot avec date passée met status=done", async () => {
    const storage = await getStorage();
    const shoot = await storage.addPhotoShoot({
      title: "Shoot passé",
      date: "2020-01-01",
      client: "Client",
    });
    expect(shoot.status).toBe("done");
  });
});

describe("storage - chat history", () => {
  it("CRUD chat sessions", async () => {
    const storage = await getStorage();
    await storage.saveChatSession({
      id: "session-1",
      title: "Test Chat",
      messages: [{ id: "m1", role: "user", content: "Hello", timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const history = await storage.getChatHistory();
    expect(history.sessions.length).toBeGreaterThan(0);

    const deleted = await storage.deleteChatSession("session-1");
    expect(deleted).toBe(true);
  });
});

describe("storage - computeNextRecurrence", () => {
  it("calcule la prochaine occurrence quotidienne", async () => {
    const storage = await getStorage();
    const next = storage.computeNextRecurrence("2026-07-15T10:00:00Z", "daily");
    expect(next).not.toBeNull();
    expect(next).toContain("2026-07-16");
  });

  it("calcule la prochaine occurrence hebdomadaire", async () => {
    const storage = await getStorage();
    const next = storage.computeNextRecurrence("2026-07-15T10:00:00Z", "weekly");
    expect(next).not.toBeNull();
    expect(next).toContain("2026-07-22");
  });

  it("calcule la prochaine occurrence mensuelle", async () => {
    const storage = await getStorage();
    const next = storage.computeNextRecurrence("2026-07-15T10:00:00Z", "monthly");
    expect(next).not.toBeNull();
    expect(next).toContain("2026-08-15");
  });

  it("retourne null si récurrence est undefined", async () => {
    const storage = await getStorage();
    const next = storage.computeNextRecurrence("2026-07-15T10:00:00Z", undefined);
    expect(next).toBeNull();
  });
});

describe("storage - reminders", () => {
  it("updateReminder met à jour un rappel", async () => {
    const storage = await getStorage();
    const added = await storage.addReminder({ title: "Test", dueAt: "2026-07-15T10:00:00Z" });
    const updated = await storage.updateReminder(added.id, { title: "Modifié" });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("Modifié");
  });

  it("updateReminder retourne null si introuvable", async () => {
    const storage = await getStorage();
    const result = await storage.updateReminder("nonexistent", { title: "X" });
    expect(result).toBeNull();
  });
});

describe("storage - fetchPageMeta", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extrait une vignette YouTube", async () => {
    const storage = await getStorage();
    const meta = await storage.fetchPageMeta("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(meta.thumbnail).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
    expect(meta.title).toBe("");
  });

  it("extrait les métadonnées d'une page HTML", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><head><title>Mon Site</title><meta property="og:image" content="https://img.jpg"></head></html>',
    } as Response);
    const storage = await getStorage();
    const meta = await storage.fetchPageMeta("https://example.com");
    expect(meta.title).toBe("Mon Site");
    expect(meta.thumbnail).toBe("https://img.jpg");
  });

  it("retourne une erreur si la page est inaccessible", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    const storage = await getStorage();
    const meta = await storage.fetchPageMeta("https://example.com/404");
    expect(meta.title).toContain("404");
  });

  it("retourne un fallback si l'appel fetch échoue", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));
    const storage = await getStorage();
    const meta = await storage.fetchPageMeta("https://example.com");
    expect(meta.title).toBe("Erreur de récupération du titre");
  });
});

describe("storage - webSearch", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("utilise Brave Search avec clé API", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: { results: [{ title: "Résultat 1", url: "https://ex.com", description: "Desc" }] },
      }),
    } as Response);
    const { webSearch } = await getStorage();
    const result = await webSearch("test");
    expect(result).toContain("Résultat 1");
  });

  it("retourne aucun résultat si Brave répond vide", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    } as Response);
    const { webSearch } = await getStorage();
    const result = await webSearch("rien");
    expect(result).toContain("Aucun résultat");
  });

  it("tombe en fallback DuckDuckGo si Brave échoue", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("Brave error"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ AbstractText: "Résultat DuckDuckGo", RelatedTopics: [] }),
      } as Response);
    const { webSearch } = await getStorage();
    const result = await webSearch("test");
    expect(result).toContain("Résultat DuckDuckGo");
  });

  it("retourne fallback si DuckDuckGo échoue aussi", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("All errors"));
    const { webSearch } = await getStorage();
    const result = await webSearch("test");
    expect(result).toContain("aucun résultat trouvé");
  });
});

describe("storage - getWeather", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("retourne erreur si pas de clé API", async () => {
    delete process.env.OPENWEATHERMAP_API_KEY;
    const { getWeather } = await getStorage();
    const result = await getWeather("Paris");
    expect(result).toBe("Erreur : clé API météo non configurée.");
  });

  it("retourne la météo formatée", async () => {
    process.env.OPENWEATHERMAP_API_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: "Paris",
        main: { temp: 22, feels_like: 20, humidity: 60 },
        weather: [{ description: "ciel dégagé" }],
        wind: { speed: 3.5 },
      }),
    } as Response);
    const { getWeather } = await getStorage();
    const result = await getWeather("Paris");
    expect(result).toContain("Paris");
    expect(result).toContain("22°C");
  });

  it("retourne ville introuvable si 404", async () => {
    process.env.OPENWEATHERMAP_API_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    const { getWeather } = await getStorage();
    const result = await getWeather("Nowhere");
    expect(result).toContain("introuvable");
  });

  it("retourne erreur générique API", async () => {
    process.env.OPENWEATHERMAP_API_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const { getWeather } = await getStorage();
    const result = await getWeather("Paris");
    expect(result).toContain("Erreur API météo (500)");
  });
});

describe("storage - prepareConcert", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("rejette si concert introuvable", async () => {
    const storage = await getStorage();
    await expect(storage.prepareConcert("nonexistent")).rejects.toThrow("introuvable");
  });

  it("retourne une préparation complète", async () => {
    process.env.OPENWEATHERMAP_API_KEY = "test-key";
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: [{ dt_txt: "2026-07-15 12:00:00", main: { temp: 25, feels_like: 23 }, weather: [{ description: "ensoleillé" }] }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: { results: [{ title: "Salle Info", url: "https://venue.com", description: "Capacité 5000" }] },
        }),
      } as Response);

    const storage = await getStorage();
    await storage.addAccreditation({ artist: "Muse", venue: "Stade", concertDate: "2026-07-15" });
    await storage.saveConcerts({ events: [{ id: "c1", artist: "Muse", venue: "Stade", date: "2026-07-15", status: "shooted" }] });

    const prep = await storage.prepareConcert("c1");
    expect(prep.weather).toContain("25°C");
    expect(prep.venueInfo).toContain("Salle Info");
    expect(prep.checklist.length).toBeGreaterThan(5);
    expect(prep.travelTips.length).toBeGreaterThan(0);
  });
});

describe("storage - autoSummarize", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retourne vide si fetch échoue", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const { autoSummarize } = await getStorage();
    const result = await autoSummarize("https://example.com", "Test");
    expect(result.summary).toBe("");
    expect(result.tags).toEqual([]);
  });

  it("retourne le résumé parsé du JSON de l'IA", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => "<html><body><p>Hello world</p></body></html>",
    } as Response);
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: '{"summary": "Un résumé", "tags": ["tag1", "tag2"]}',
      toolCalls: [],
    });
    const { autoSummarize } = await getStorage();
    const result = await autoSummarize("https://example.com", "Test");
    expect(result.summary).toBe("Un résumé");
    expect(result.tags).toEqual(["tag1", "tag2"]);
  });

  it("retourne le texte brut si l'IA ne renvoie pas de JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => "<html><body><p>Hello</p></body></html>",
    } as Response);
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: "Résumé simple sans JSON",
      toolCalls: [],
    });
    const { autoSummarize } = await getStorage();
    const result = await autoSummarize("https://example.com", "Test");
    expect(result.summary).toBe("Résumé simple sans JSON");
    expect(result.tags).toEqual([]);
  });
});
