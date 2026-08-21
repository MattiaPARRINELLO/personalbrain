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

const { POST } = await import("@/app/api/chat/confirm-batch/route");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat/confirm-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat/confirm-batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: "owner" });
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("refuse sans session", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ actions: [{ name: "send_email_response", arguments: {} }] }));
    expect(res.status).toBe(401);
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it("refuse un corps sans actions ou actions non confirmables", async () => {
    const empty = await POST(makeRequest({ actions: [] }));
    expect(empty.status).toBe(400);

    const nonConfirmable = await POST(makeRequest({ actions: [{ name: "web_search", arguments: {} }] }));
    expect(nonConfirmable.status).toBe(400);
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it("exécute toutes les actions du lot et renvoie les résultats", async () => {
    mockExecuteTool.mockImplementation(async (name: string) => `ok:${name}`);
    const res = await POST(
      makeRequest({
        actions: [
          { name: "send_email_response", arguments: { email_id: "a", response_text: "ok" } },
          { name: "create_calendar_event", arguments: { title: "R", start_time: "x", end_time: "y" } },
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results.every((r: { ok: boolean }) => r.ok)).toBe(true);
    expect(mockExecuteTool).toHaveBeenCalledTimes(2);
    expect(mockExecuteTool).toHaveBeenCalledWith("send_email_response", { email_id: "a", response_text: "ok" }, true);
    expect(mockExecuteTool).toHaveBeenCalledWith("create_calendar_event", { title: "R", start_time: "x", end_time: "y" }, true);
    expect(mockLogActivity).toHaveBeenCalledTimes(2);
  });

  it("continue le lot et marque en échec une action qui échoue", async () => {
    mockExecuteTool.mockImplementation(async (name: string) => {
      if (name === "schedule_followup") throw new Error("boom");
      return "ok";
    });
    const res = await POST(
      makeRequest({
        actions: [
          { name: "schedule_followup", arguments: { subject: "s" } },
          { name: "send_email_response", arguments: { email_id: "a", response_text: "ok" } },
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0]).toEqual({ name: "schedule_followup", ok: false, error: "boom" });
    expect(body.results[1].ok).toBe(true);
    expect(mockExecuteTool).toHaveBeenCalledTimes(2);
    expect(mockLogActivity).toHaveBeenCalledTimes(2);
  });

  it("répond 400 sur un corps invalide", async () => {
    const res = await POST(new Request("http://localhost/api/chat/confirm-batch", { method: "POST", body: "pas du json" }));
    expect(res.status).toBe(400);
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });
});
