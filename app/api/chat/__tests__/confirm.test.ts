import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));

const mockExecuteTool = vi.fn();
vi.mock("@/lib/chat-tools", () => ({
  executeTool: mockExecuteTool,
  REQUIRE_CONFIRMATION: new Set([
    "send_email_response",
    "create_calendar_event",
    "update_calendar_event",
    "schedule_followup",
    "scan_accreditations",
  ]),
}));

const mockLogActivity = vi.fn();
vi.mock("@/lib/storage", () => ({ logActivity: mockLogActivity }));

const { POST } = await import("@/app/api/chat/confirm/route");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: "owner" });
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("refuse sans session", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ name: "send_email_response", arguments: {} }));
    expect(res.status).toBe(401);
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it("refuse un outil non confirmable (pas de porte d'exécution arbitraire)", async () => {
    const res = await POST(makeRequest({ name: "web_search", arguments: { query: "x" } }));
    expect(res.status).toBe(400);
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it("exécute un outil confirmable avec la confirmation", async () => {
    mockExecuteTool.mockResolvedValue("Reponse envoyee (message id: m1).");
    const res = await POST(
      makeRequest({ name: "send_email_response", arguments: { email_id: "a", response_text: "ok" } })
    );
    expect(res.status).toBe(200);
    expect(mockExecuteTool).toHaveBeenCalledWith("send_email_response", { email_id: "a", response_text: "ok" }, true);
    expect(mockLogActivity).toHaveBeenCalled();
  });

  it("répond 500 et journalise en cas d'échec", async () => {
    mockExecuteTool.mockRejectedValue(new Error("boom"));
    const res = await POST(makeRequest({ name: "send_email_response", arguments: {} }));
    expect(res.status).toBe(500);
    expect(mockLogActivity).toHaveBeenCalled();
  });

  it("répond 400 sur un corps invalide", async () => {
    const res = await POST(new Request("http://localhost/api/chat/confirm", {
      method: "POST",
      body: "pas du json",
    }));
    expect(res.status).toBe(400);
  });
});
