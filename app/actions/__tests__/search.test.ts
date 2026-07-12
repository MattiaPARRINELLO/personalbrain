import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  getConcerts: vi.fn(),
  getMemory: vi.fn(),
  getEmails: vi.fn(),
  getReminders: vi.fn(),
  getWatchLater: vi.fn(),
  getAccreditations: vi.fn(),
  searchEmails: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);

const { unifiedSearch } = await import("@/app/actions/search");

describe("unifiedSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getConcerts.mockResolvedValue({ events: [] });
    mockStorage.getMemory.mockResolvedValue({ facts: [], relationships: [], profile: { name: "", preferences: [] } });
    mockStorage.getEmails.mockResolvedValue({ emails: [] });
    mockStorage.getReminders.mockResolvedValue({ reminders: [] });
    mockStorage.getWatchLater.mockResolvedValue({ items: [] });
    mockStorage.getAccreditations.mockResolvedValue({ accreditations: [] });
    mockStorage.searchEmails.mockResolvedValue([]);
  });

  it("retourne un résultat vide pour une requête vide", async () => {
    const result = await unifiedSearch("");
    expect(result.concerts).toEqual([]);
    expect(result.facts).toEqual([]);
    expect(result.emails).toEqual([]);
  });

  it("filtre les concerts par artiste", async () => {
    mockStorage.getConcerts.mockResolvedValue({
      events: [
        { id: "1", artist: "Muse", venue: "Stade", date: "2026-07-15" },
        { id: "2", artist: "Radiohead", venue: "Zénith", date: "2026-08-01" },
      ],
    });
    const result = await unifiedSearch("muse");
    expect(result.concerts).toHaveLength(1);
    expect(result.concerts[0].artist).toBe("Muse");
  });

  it("filtre les reminders par titre", async () => {
    mockStorage.getReminders.mockResolvedValue({
      reminders: [
        { id: "1", title: "Acheter du lait", notes: "", dueAt: "2026-07-15T10:00:00Z", status: "pending", createdAt: "", updatedAt: "", notifiedAt: null },
        { id: "2", title: "Appeler Jean", notes: "", dueAt: "2026-07-16T10:00:00Z", status: "pending", createdAt: "", updatedAt: "", notifiedAt: null },
      ],
    });
    const result = await unifiedSearch("lait");
    expect(result.reminders).toHaveLength(1);
    expect(result.reminders[0].title).toBe("Acheter du lait");
  });

  it("filtre les reminders par notes", async () => {
    mockStorage.getReminders.mockResolvedValue({
      reminders: [
        { id: "1", title: "Course", notes: "Ne pas oublier le pain", dueAt: "2026-07-15T10:00:00Z", status: "pending", createdAt: "", updatedAt: "", notifiedAt: null },
      ],
    });
    const result = await unifiedSearch("pain");
    expect(result.reminders).toHaveLength(1);
  });

  it("filtre les accreditations par artiste, venue, notes", async () => {
    mockStorage.getAccreditations.mockResolvedValue({
      accreditations: [
        { id: "1", artist: "Muse", venue: "Stade", concertDate: "2026-08-01", status: "pending", contactEmail: "", notes: "Dernière minute", createdAt: "", updatedAt: "" },
      ],
    });
    const result = await unifiedSearch("dernière");
    expect(result.accreditations).toHaveLength(1);
  });

  it("filtre les faits mémoire par contenu et catégorie", async () => {
    mockStorage.getMemory.mockResolvedValue({
      facts: [
        { id: "1", content: "J'adore le jazz", category: "preference", createdAt: "" },
        { id: "2", content: "React est génial", category: "dev", createdAt: "" },
      ],
      relationships: [],
      profile: { name: "", preferences: [] },
    });
    const result = await unifiedSearch("jazz");
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].content).toBe("J'adore le jazz");
  });
});
