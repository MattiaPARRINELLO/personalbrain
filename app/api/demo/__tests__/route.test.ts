import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRecordDemoCall = vi.fn();
vi.mock("@/lib/storage", () => ({ recordDemoCall: mockRecordDemoCall }));

const mockCheckRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mockCheckRateLimit }));

const mockGetClientConfig = vi.fn();
vi.mock("@/lib/ai-providers/config", () => ({ getClientConfig: mockGetClientConfig }));

const mockCreate = vi.fn();
const mockOpenAI = vi.fn(function OpenAI() {
  return { chat: { completions: { create: mockCreate } } };
});
vi.mock("openai", () => ({ default: mockOpenAI }));

const { POST } = await import("@/app/api/demo/route");

function makeRequest(ip = "203.0.113.1"): NextRequest {
  return new NextRequest("http://localhost/api/demo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `${ip}, 10.0.0.1`,
    },
    body: JSON.stringify({ message: "Que dois-je préparer pour demain ?" }),
  });
}

describe("POST /api/demo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordDemoCall.mockResolvedValue(undefined);
    mockCheckRateLimit.mockReturnValue(true);
    mockGetClientConfig.mockReturnValue({ baseURL: "http://provider.test/v1" });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Charge tes batteries et tes cartes." } }],
    });
  });

  it("isole le quota par adresse IP", async () => {
    const first = await POST(makeRequest("203.0.113.1"));
    const second = await POST(makeRequest("203.0.113.2"));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(1, "demo:203.0.113.1", 8);
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(2, "demo:global", 60);
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(3, "demo:203.0.113.2", 8);
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(4, "demo:global", 60);
  });

  it("utilise x-real-ip lorsque x-forwarded-for est absent", async () => {
    const request = new NextRequest("http://localhost/api/demo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-real-ip": "198.51.100.7",
      },
      body: JSON.stringify({ message: "Résume le shooting" }),
    });

    await POST(request);

    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(1, "demo:198.51.100.7", 8);
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(2, "demo:global", 60);
  });

  it("refuse une requête au-delà du quota individuel", async () => {
    mockCheckRateLimit.mockImplementation((key) => key !== "demo:203.0.113.1");

    const response = await POST(makeRequest());

    expect(response.status).toBe(429);
    expect(mockCheckRateLimit).toHaveBeenCalledWith("demo:203.0.113.1", 8);
    expect(mockCheckRateLimit).not.toHaveBeenCalledWith("demo:global", 60);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRecordDemoCall).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "rate_limited",
      status: 429,
      input: "{\"message\":\"Que dois-je préparer pour demain ?\"}",
      ip: "203.0.113.1",
    }));
  });

  it("journalise la question, la réponse et les métadonnées", async () => {
    await POST(makeRequest());

    expect(mockRecordDemoCall).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "success",
      status: 200,
      input: "Que dois-je préparer pour demain ?",
      response: "Charge tes batteries et tes cartes.",
      model: "deepseek-v4-flash",
      ip: "203.0.113.1",
    }));
  });

  it("conserve un plafond global de protection du provider", async () => {
    mockCheckRateLimit.mockImplementation((key) => key !== "demo:global");

    const response = await POST(makeRequest());

    expect(response.status).toBe(429);
    expect(mockCheckRateLimit).toHaveBeenCalledWith("demo:global", 60);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
