import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Graphe d'imports complet de app/api/chat/route.ts, mocké pour tester le
// handler isolément (aucun appel réseau ni IA réel).
const mockGetSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));

const mockCheckRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mockCheckRateLimit }));

const mockGetModel = vi.fn();
vi.mock("@/lib/config", () => ({ getModel: mockGetModel }));

const mockStorage = {
  fetchPageMeta: vi.fn(),
  autoSummarize: vi.fn(),
};
vi.mock("@/lib/storage", () => mockStorage);

const mockBuildSystemPrompt = vi.fn();
vi.mock("@/lib/chat-prompts", () => ({ buildSystemPrompt: mockBuildSystemPrompt }));

const mockExecuteTool = vi.fn();
const mockConfirmationMessage = vi.fn();
vi.mock("@/lib/chat-tools", () => ({
  tools: [],
  REQUIRE_CONFIRMATION: new Set(["send_email_response"]),
  executeTool: mockExecuteTool,
  confirmationMessage: mockConfirmationMessage,
}));

const mockAutoExtractMemoryFacts = vi.fn().mockResolvedValue(undefined);
vi.mock("@/app/actions/brain", () => ({ autoExtractMemoryFacts: mockAutoExtractMemoryFacts }));

const mockStream = vi.fn();
vi.mock("@/lib/ai-providers", () => ({ streamChatCompletion: mockStream }));

const { POST } = await import("@/app/api/chat/route");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function* fakeStream(events: unknown[]) {
  for (const e of events) yield e;
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: "owner" });
    mockCheckRateLimit.mockReturnValue(true);
    mockGetModel.mockResolvedValue({ primary: "model-test", alt: "model-test" });
    mockBuildSystemPrompt.mockResolvedValue("system prompt");
    mockConfirmationMessage.mockReturnValue("ACTION_BLOCKED:send_email_response");
    // Retourne l'AsyncGenerator directement (pas de wrapper async : la route
    // itère dessus avec `for await`).
    mockStream.mockImplementation(() => fakeStream([{ type: "done", content: "Salut !" }]));
  });

  it("refuse sans session (401)", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Salut" }] }));
    expect(res.status).toBe(401);
  });

  it("refuse au-delà du rate limit (429)", async () => {
    mockCheckRateLimit.mockReturnValue(false);
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Salut" }] }));
    expect(res.status).toBe(429);
  });

  it("refuse un corps invalide (400)", async () => {
    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("stream une réponse SSE avec l'événement done", async () => {
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Bonjour" }] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(mockStream).toHaveBeenCalledWith("model-test", expect.anything(), expect.anything(), expect.anything());
  });

  it("bloque un outil à effet externe sans confirmation et ne l'exécute pas", async () => {
    mockStream.mockImplementation(() =>
      fakeStream([
        { type: "tool_start", toolCallId: "tc-1", name: "send_email_response", arguments: '{"email_id":"a","response_text":"ok"}' },
        { type: "done", content: "" },
      ])
    );
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Envoie un mail" }] }));
    expect(res.status).toBe(200);
    const text = await res.text();
    // La carte de confirmation est émise et le résultat renvoyé au modèle est bloqué.
    expect(text).toContain('"type":"tool_confirm"');
    expect(text).toContain("ACTION_BLOCKED");
    expect(mockExecuteTool).not.toHaveBeenCalled();
    expect(mockConfirmationMessage).toHaveBeenCalled();
  });

  it("exécute un outil de lecture (non confirmé) normalement", async () => {
    mockStream.mockImplementation(() =>
      fakeStream([
        { type: "tool_start", toolCallId: "tc-1", name: "web_search", arguments: '{"query":"test"}' },
        { type: "done", content: "" },
      ])
    );
    mockExecuteTool.mockResolvedValue("résultats web");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Cherche" }] }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("résultats web");
    expect(mockExecuteTool).toHaveBeenCalledWith("web_search", { query: "test" });
  });

  it("ne crée pas de carte de confirmation ni d'exécution pour des arguments JSON invalides", async () => {
    mockStream.mockImplementation(() =>
      fakeStream([
        {
          type: "tool_start",
          toolCallId: "tc-1",
          name: "send_email_response",
          arguments: '{"email_id":"a","response_text":invalide}',
        },
        { type: "done", content: "" },
      ])
    );
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Envoie un mail" }] }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('"type":"tool_confirm"');
    expect(text).toContain("Erreur: arguments d'outil invalides (JSON)");
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it("injecte la règle d'honnêteté quand le dernier résultat d'outil est une erreur", async () => {
    let callCount = 0;
    mockStream.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return fakeStream([
          { type: "tool_start", toolCallId: "tc-1", name: "web_search", arguments: '{"query":"test"}' },
          { type: "done", content: "" },
        ]);
      }
      return fakeStream([{ type: "done", content: "Voilà le résultat." }]);
    });
    mockExecuteTool.mockResolvedValue("Erreur: boom");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Cherche" }] }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Voilà le résultat.");
    expect(callCount).toBe(2);
    const secondCallMessages = mockStream.mock.calls[1][1] as { role: string; content?: string }[];
    const lastMsg = secondCallMessages[secondCallMessages.length - 1];
    expect(lastMsg?.role).toBe("system");
    expect(lastMsg?.content).toContain("Ne pretend JAMAIS");
  });

  it("n'injecte pas la règle d'honnêteté quand le dernier résultat d'outil est un succès", async () => {
    let callCount = 0;
    mockStream.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return fakeStream([
          { type: "tool_start", toolCallId: "tc-1", name: "web_search", arguments: '{"query":"test"}' },
          { type: "done", content: "" },
        ]);
      }
      return fakeStream([{ type: "done", content: "Voilà le résultat." }]);
    });
    mockExecuteTool.mockResolvedValue("résultats web");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Cherche" }] }));
    expect(res.status).toBe(200);
    // Consomme le stream : sans cela, l'itération 2 (appel n°2 de mockStream)
    // peut ne pas encore avoir démarré quand on inspecte les appels.
    await res.text();
    expect(callCount).toBe(2);
    const secondCallMessages = mockStream.mock.calls[1][1] as { role: string; content?: string }[];
    const lastMsg = secondCallMessages[secondCallMessages.length - 1];
    expect(lastMsg?.role).not.toBe("system");
  });
});
