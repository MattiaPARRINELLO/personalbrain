import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  getConcerts: vi.fn(),
  saveConcerts: vi.fn(),
  logActivity: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);
vi.mock("@/lib/session", () => ({ requireSession: vi.fn().mockResolvedValue({ userId: "test-user" }) }));

const { loadConcerts, saveConcertEvents } = await import("@/app/actions/concerts");

describe("concerts actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loadConcerts retourne les concerts", async () => {
    mockStorage.getConcerts.mockResolvedValue({ events: [] });
    const result = await loadConcerts();
    expect(result.events).toEqual([]);
  });

  it("saveConcertEvents sauvegarde et log", async () => {
    const events: import("@/lib/types").ConcertEvent[] = [{ id: "1", artist: "Muse", venue: "Stade", date: "2026-08-01", status: "shooted" }];
    await saveConcertEvents(events);
    expect(mockStorage.saveConcerts).toHaveBeenCalledWith({ events });
    expect(mockStorage.logActivity).toHaveBeenCalledWith("concert_updated", expect.any(String));
  });
});
