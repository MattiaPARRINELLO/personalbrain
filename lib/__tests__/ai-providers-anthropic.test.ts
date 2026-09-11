import { describe, it, expect, vi, beforeEach } from "vitest";

// getClientConfig()/getAnthropicClientConfig() lisent ces variables au moment
// de l'appel du module (les constantes sont resolues a l'import).
process.env.NEXT_PUBLIC_API_URL = "https://example.test/go/v1";
process.env.IA_API_KEY = "test-key";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

const { streamAnthropic, chatAnthropic } = await import("@/lib/ai-providers/anthropic");

async function* fakeStream(events: unknown[]) {
  for (const e of events) yield e;
}

async function collectEvents(events: unknown[]) {
  mockCreate.mockResolvedValue(fakeStream(events));
  const out: { type: string; content?: string; name?: string; arguments?: string }[] = [];
  for await (const e of streamAnthropic("test-model", [{ role: "user", content: "hi" }], [])) {
    out.push(e as { type: string });
  }
  return out;
}

function toolUseStart(id: string, name: string) {
  return { type: "content_block_start", content_block: { type: "tool_use", id, name } };
}

function jsonDelta(partial: string) {
  return { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: partial } };
}

const STOP = { type: "content_block_stop" };
const TOOL_USE_END = { type: "message_delta", delta: { stop_reason: "tool_use" } };

describe("streamAnthropic — fumee et robustesse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("remonte les blocs de raisonnement comme le fait l'adaptateur OpenAI", async () => {
    const events = await collectEvents([
      { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "je reflechis" } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "Salut" } },
      { type: "message_delta", delta: { stop_reason: "end_turn" } },
    ]);
    const reasoning = events.filter((e) => e.type === "reasoning");
    expect(reasoning).toHaveLength(1);
    expect(reasoning[0]!.content).toBe("je reflechis");
    expect(events.find((e) => e.type === "done")?.content).toBe("Salut");
  });

  it("accumule les fragments d'arguments et emet le tool_start", async () => {
    const events = await collectEvents([
      toolUseStart("toolu_1", "add_reminder"),
      jsonDelta('{"title":"Test",'),
      jsonDelta('"due_at":"2026-01-01"}'),
      STOP,
      TOOL_USE_END,
    ]);
    const start = events.find((e) => e.type === "tool_start");
    expect(start?.name).toBe("add_reminder");
    expect(start?.arguments).toBe('{"title":"Test","due_at":"2026-01-01"}');
  });

  it("normalise un outil sans argument en objet JSON vide", async () => {
    const events = await collectEvents([toolUseStart("toolu_1", "ping"), STOP, TOOL_USE_END]);
    expect(events.find((e) => e.type === "tool_start")?.arguments).toBe("{}");
  });

  it("ne complete PAS un JSON tronque (sinon l'action serait executee avec de faux arguments)", async () => {
    const events = await collectEvents([
      toolUseStart("toolu_1", "add_reminder"),
      jsonDelta('{"title":"Test","due_at":"2026'),
      STOP,
      TOOL_USE_END,
    ]);
    expect(events.find((e) => e.type === "tool_start")?.arguments).toBe('{"title":"Test","due_at":"2026');
  });
});

describe("adaptateurs Anthropic — parametres envoyes au provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omet tools et tool_choice quand aucun outil n'est fourni", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "Salut" }] });
    await chatAnthropic("test-model", [{ role: "user", content: "hi" }], []);
    const payload = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.tools).toBeUndefined();
    expect(payload.tool_choice).toBeUndefined();
  });

  it("envoie tools et tool_choice des qu'un outil est fourni", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "Salut" }] });
    await chatAnthropic("test-model", [{ role: "user", content: "hi" }], [
      { name: "ping", description: "x", parameters: { type: "object", properties: {} } },
    ]);
    const payload = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.tools).toHaveLength(1);
    expect(payload.tool_choice).toEqual({ type: "auto" });
  });
});

describe("getAnthropicClientConfig — baseURL", () => {
  // Le SDK Anthropic prefixe lui-meme ses routes par `/v1` : une baseURL
  // terminee par `/v1` produisait `/v1/v1/messages` (404).
  it("retire le suffixe /v1 attendu par le SDK OpenAI mais interdit ici", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_URL = "https://example.test/go/v1";
    const { getAnthropicClientConfig } = await import("@/lib/ai-providers/config");
    expect(getAnthropicClientConfig().baseURL).toBe("https://example.test/go");
  });

  it("laisse une baseURL sans /v1 inchangee", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_URL = "https://example.test/go";
    const { getAnthropicClientConfig } = await import("@/lib/ai-providers/config");
    expect(getAnthropicClientConfig().baseURL).toBe("https://example.test/go");
  });
});
