import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStorage = {
  webSearch: vi.fn(),
  addReminder: vi.fn(),
  updateReminder: vi.fn(),
  addWatchLaterItem: vi.fn(),
  fetchPageMeta: vi.fn(),
  getConcerts: vi.fn(),
  getAccreditations: vi.fn(),
  getReminders: vi.fn(),
  addAccreditation: vi.fn(),
  saveAccreditations: vi.fn(),
  prepareConcert: vi.fn(),
  getWeather: vi.fn(),
  getPhotoShoots: vi.fn(),
  addPhotoShoot: vi.fn(),
  updatePhotoShoot: vi.fn(),
  addIntention: vi.fn(),
  addMemoryFact: vi.fn(),
  isSafeFetchUrl: vi.fn().mockResolvedValue(true),
};

const mockGoogleActions = {
  fetchGmailMessages: vi.fn(),
  sendGmailReply: vi.fn(),
  createGoogleCalendarEvent: vi.fn(),
  fetchGoogleCalendarEvents: vi.fn(),
  updateGoogleCalendarEvent: vi.fn(),
  deleteGoogleCalendarEvent: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);
vi.mock("@/lib/google-actions", () => mockGoogleActions);

const { executeTool, REQUIRE_CONFIRMATION, ACTION_BLOCKED_PREFIX } = await import("@/lib/chat-tools");

describe("chat-tools — confirmation des actions IA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getReminders.mockResolvedValue({ reminders: [] });
    mockStorage.getAccreditations.mockResolvedValue({ accreditations: [] });
    mockStorage.getConcerts.mockResolvedValue({ events: [] });
    mockStorage.getPhotoShoots.mockResolvedValue({ shoots: [] });
  });

  it("liste les outils exigeant une confirmation (uniquement l'envoi d'emails)", () => {
    expect(REQUIRE_CONFIRMATION.has("send_email_response")).toBe(true);
    // Calendrier, rappels, scan, lectures : exécution directe sans confirmation.
    expect(REQUIRE_CONFIRMATION.has("create_calendar_event")).toBe(false);
    expect(REQUIRE_CONFIRMATION.has("update_calendar_event")).toBe(false);
    expect(REQUIRE_CONFIRMATION.has("delete_calendar_event")).toBe(false);
    expect(REQUIRE_CONFIRMATION.has("schedule_followup")).toBe(false);
    // Le scan des accréditations (analyse d'emails) et les lectures seules ne
    // demandent pas de confirmation.
    expect(REQUIRE_CONFIRMATION.has("scan_accreditations")).toBe(false);
    // Les lectures seules ne demandent pas de confirmation.
    expect(REQUIRE_CONFIRMATION.has("web_search")).toBe(false);
    expect(REQUIRE_CONFIRMATION.has("list_reminders")).toBe(false);
  });

  it("bloque l'envoi d'email sans confirmation et n'exécute pas l'action", async () => {
    mockGoogleActions.sendGmailReply.mockResolvedValue("msg-1");
    const result = await executeTool("send_email_response", {
      email_id: "abc",
      response_text: "Bonjour",
    });
    expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(true);
    expect(mockGoogleActions.sendGmailReply).not.toHaveBeenCalled();
  });

  it("exécute l'action quand la confirmation est fournie", async () => {
    mockGoogleActions.sendGmailReply.mockResolvedValue("msg-1");
    const result = await executeTool(
      "send_email_response",
      { email_id: "abc", response_text: "Bonjour" },
      true
    );
    expect(result).toContain("msg-1");
    expect(mockGoogleActions.sendGmailReply).toHaveBeenCalledWith("abc", "Bonjour");
  });

  it("exécute la création d'événement calendrier sans confirmation", async () => {
    mockGoogleActions.createGoogleCalendarEvent.mockResolvedValue("evt-1");
    const result = await executeTool("create_calendar_event", {
      title: "Réunion",
      start_time: "2026-08-10T10:00:00Z",
      end_time: "2026-08-10T11:00:00Z",
    });
    expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(false);
    expect(mockGoogleActions.createGoogleCalendarEvent).toHaveBeenCalledWith(
      "Réunion",
      "2026-08-10T10:00:00Z",
      "2026-08-10T11:00:00Z",
      undefined,
      undefined,
      undefined
    );
  });

  it("exécute la suppression d'événement calendrier sans confirmation", async () => {
    mockGoogleActions.deleteGoogleCalendarEvent.mockResolvedValue(undefined);
    const result = await executeTool("delete_calendar_event", { event_id: "evt-1" });
    expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(false);
    expect(mockGoogleActions.deleteGoogleCalendarEvent).toHaveBeenCalledWith("evt-1");
  });

  it("n'exécute pas un outil de lecture sans confirmation (aucun blocage)", async () => {
    mockStorage.webSearch.mockResolvedValue("Résultats");
    const result = await executeTool("web_search", { query: "test" });
    expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(false);
    expect(mockStorage.webSearch).toHaveBeenCalledWith("test");
  });

  it("exécute le scan des accréditations sans confirmation (analyse d'emails)", async () => {
    // Un email sans artiste détecté : le scan aboutit quand même (déclenché
    // immédiatement, jamais bloqué en attente de confirmation).
    mockGoogleActions.fetchGmailMessages.mockResolvedValue([
      { id: "m1", from: "a@b.fr", subject: "Re: accreditation", date: "2026-08-20", snippet: "confirme le pass presse" },
    ]);
    const result = await executeTool("scan_accreditations", {});
    expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(false);
    expect(result).toContain("Scan termine");
    expect(mockGoogleActions.fetchGmailMessages).toHaveBeenCalled();
  });
});
