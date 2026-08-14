import { describe, it, expect, vi } from "vitest";

// getClientConfig() lit ces variables au moment de l'appel.
process.env.NEXT_PUBLIC_API_URL = "https://example.test";
process.env.IA_API_KEY = "test-key";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

const { streamOpenAI } = await import("@/lib/ai-providers/openai");

async function* fakeCompletions(chunks: unknown[]) {
  for (const c of chunks) yield c;
}

function tc(index: number, id: string | undefined, args: string, name?: string) {
  return {
    index,
    id,
    type: "function",
    function: { name, arguments: args },
  };
}

function chunk(delta: unknown, finish?: string) {
  return { choices: [{ delta, ...(finish ? { finish_reason: finish } : {}) }] };
}

async function collectEvents(chunks: unknown[]) {
  mockCreate.mockResolvedValue(fakeCompletions(chunks));
  const events: { type: string; name?: string; arguments?: string; content?: string }[] = [];
  for await (const e of streamOpenAI("test-model", [{ role: "user", content: "hi" }], [])) {
    events.push(e as { type: string; name?: string; arguments?: string; content?: string });
  }
  return events;
}

describe("streamOpenAI — accumulation des tool calls", () => {
  it("concatène les fragments d'arguments streamés incrémentalement", async () => {
    const events = await collectEvents([
      chunk({ tool_calls: [tc(0, "call_1", '{"title":"T', "add_reminder")] }),
      chunk({ tool_calls: [tc(0, undefined, 'est","due_at":"2026-01-01T10:00:00"}')] }),
      chunk({}, "tool_calls"),
    ]);
    const start = events.find((e) => e.type === "tool_start");
    expect(start).toBeDefined();
    expect(start!.name).toBe("add_reminder");
    expect(start!.arguments).toBe('{"title":"Test","due_at":"2026-01-01T10:00:00"}');
  });

  it("remplace un appel complet répété à chaque chunk (provider qui renvoie l'id systématiquement)", async () => {
    const events = await collectEvents([
      chunk({ tool_calls: [tc(0, "call_1", '{"query":"a"}', "web_search")] }),
      chunk({ tool_calls: [tc(0, "call_1", '{"query":"ab"}', "web_search")] }),
      chunk({}, "tool_calls"),
    ]);
    const start = events.find((e) => e.type === "tool_start");
    expect(start!.arguments).toBe('{"query":"ab"}');
  });

  it("émet quand même les tool calls accumulés si le stream s'arrête sur stop", async () => {
    const events = await collectEvents([
      chunk({ tool_calls: [tc(0, "call_1", '{"query":"test"}', "web_search")] }),
      chunk({}, "stop"),
    ]);
    expect(events.some((e) => e.type === "tool_start")).toBe(true);
    expect(events.some((e) => e.type === "done")).toBe(true);
  });
});
