import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  addCalendarEvent: vi.fn(),
  getCalendar: vi.fn(),
  getEmails: vi.fn(),
  searchEmails: vi.fn(),
  webSearch: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);

const { loadCalendar, createCalendarEvent, loadEmails, findEmails, searchWeb } = await import("@/app/actions/ai-tools");

describe("ai-tools actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loadCalendar retourne les événements", async () => {
    mockStorage.getCalendar.mockResolvedValue([]);
    expect(await loadCalendar()).toEqual([]);
  });

  it("createCalendarEvent crée un événement", async () => {
    const event = { title: "Meeting", date: "2026-07-15T10:00:00Z", type: "meeting" as const };
    mockStorage.addCalendarEvent.mockResolvedValue({ id: "1", ...event });
    const result = await createCalendarEvent(event);
    expect(result.title).toBe("Meeting");
  });

  it("loadEmails retourne les emails", async () => {
    mockStorage.getEmails.mockResolvedValue({ emails: [{ id: "1", from: "test@example.com", subject: "Hello", body: "Hi", date: "", unread: false }] });
    const result = await loadEmails();
    expect(result).toHaveLength(1);
  });

  it("findEmails cherche des emails", async () => {
    mockStorage.searchEmails.mockResolvedValue([{ id: "1", from: "john@example.com", subject: "Re: Project", body: "Sure", date: "", unread: false }]);
    const result = await findEmails("john");
    expect(result).toHaveLength(1);
  });

  it("searchWeb effectue une recherche", async () => {
    mockStorage.webSearch.mockResolvedValue("Résultat de recherche");
    const result = await searchWeb("test query");
    expect(result).toBe("Résultat de recherche");
  });
});
