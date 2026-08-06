import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  getMemory: vi.fn(),
  addMemoryFact: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);
vi.mock("@/lib/session", () => ({ requireSession: vi.fn().mockResolvedValue({ userId: "test-user" }) }));

const { loadMemory, rememberFact } = await import("@/app/actions/memory");

describe("memory action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loadMemory retourne les données", async () => {
    mockStorage.getMemory.mockResolvedValue({ facts: [], relationships: [], profile: { name: "", preferences: [] } });
    const result = await loadMemory();
    expect(result.facts).toEqual([]);
  });

  it("rememberFact ajoute un fait", async () => {
    const mockFact = { id: "1", content: "Test", category: "life", source: "manual", createdAt: "" };
    mockStorage.addMemoryFact.mockResolvedValue(mockFact);
    const fact = await rememberFact("Test", "life");
    expect(fact.content).toBe("Test");
  });
});
