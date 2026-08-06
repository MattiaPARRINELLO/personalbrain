import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  getMemory: vi.fn(),
  saveMemory: vi.fn(),
  addMemoryFact: vi.fn(),
  updateMemoryFact: vi.fn(),
  deleteMemoryFact: vi.fn(),
  getMemoryRelationships: vi.fn(),
  findSimilarMemoryFacts: vi.fn(),
  touchMemoryFact: vi.fn(),
  logActivity: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireSession: vi.fn().mockResolvedValue({ userId: "test-user" }) }));

const { loadBrain, rememberFact, autoExtractMemoryFacts, editMemoryFact, forgetFact, loadMemoryRelationships, updateProfile } = await import("@/app/actions/brain");

describe("brain actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getMemory.mockResolvedValue({ facts: [], relationships: [], profile: { name: "", preferences: [] } });
  });

  it("loadBrain retourne la mémoire", async () => {
    const result = await loadBrain();
    expect(result.facts).toEqual([]);
  });

  describe("rememberFact", () => {
    it("ajoute un fait", async () => {
      const mockFact = { id: "1", content: "Test", category: "dev", source: "manual", createdAt: "" };
      mockStorage.addMemoryFact.mockResolvedValue(mockFact);
      const fact = await rememberFact("Test", "dev");
      expect(fact.content).toBe("Test");
      expect(mockStorage.addMemoryFact).toHaveBeenCalledWith("Test", "dev", expect.objectContaining({}));
    });

    it("avec options avancées", async () => {
      await rememberFact("Test", "life", { source: "auto-extract", confidence: 0.95 });
      expect(mockStorage.addMemoryFact).toHaveBeenCalledWith("Test", "life", { source: "auto-extract", confidence: 0.95 });
    });

    it("rejette si contenu vide", async () => {
      await expect(rememberFact("", "dev")).rejects.toThrow("Contenu requis");
    });

    it("rejette si catégorie invalide", async () => {
      await expect(rememberFact("Test", "invalid" as never)).rejects.toThrow();
    });
  });

  describe("autoExtractMemoryFacts", () => {
    it("extrait des faits depuis un objet structuré", async () => {
      mockStorage.addMemoryFact.mockResolvedValue({ id: "1", content: "", category: "dev", source: "auto-extract", createdAt: "" });
      const result = await autoExtractMemoryFacts({
        facts: [
          { content: "Aime le café", category: "preference", confidence: 0.9 },
          { content: "Utilise TypeScript", category: "dev", confidence: 0.8 },
        ],
      });
      expect(result).toHaveLength(2);
      expect(mockStorage.addMemoryFact).toHaveBeenCalledTimes(2);
    });

    it("ignore les faits avec confidence < 0.7", async () => {
      const result = await autoExtractMemoryFacts({
        facts: [
          { content: "Faible confiance", category: "dev", confidence: 0.3 },
        ],
      });
      expect(result).toHaveLength(0);
      expect(mockStorage.addMemoryFact).not.toHaveBeenCalled();
    });

    it("réutilise un fait existant via findSimilarMemoryFacts", async () => {
      const existingFact = { id: "1", content: "Utilise TypeScript", category: "dev", source: "auto-extract", createdAt: "" };
      mockStorage.findSimilarMemoryFacts.mockResolvedValue(existingFact);
      const result = await autoExtractMemoryFacts({
        facts: [
          { content: "Utilise TypeScript", category: "dev", confidence: 0.95 },
        ],
      });
      expect(result).toHaveLength(1);
      expect(mockStorage.addMemoryFact).not.toHaveBeenCalled();
      expect(mockStorage.touchMemoryFact).toHaveBeenCalledWith("1");
    });

    it("rejette si format invalide", async () => {
      await expect(autoExtractMemoryFacts({ facts: "pas un tableau" as never })).rejects.toThrow();
    });

    it("rejette si trop de faits (max 8)", async () => {
      const manyFacts = Array.from({ length: 9 }, (_, i) => ({
        content: `Fact ${i}`, category: "dev" as const, confidence: 0.5,
      }));
      await expect(autoExtractMemoryFacts({ facts: manyFacts })).rejects.toThrow(/8|max|trop/i);
    });
  });

  describe("editMemoryFact", () => {
    it("modifie un fait", async () => {
      const mockFact = { id: "1", content: "Updated", category: "life", source: "manual", createdAt: "" };
      mockStorage.updateMemoryFact.mockResolvedValue(mockFact);
      const result = await editMemoryFact("1", { content: "Updated", category: "life" });
      expect(result).not.toBeNull();
      expect(result!.content).toBe("Updated");
    });

    it("retourne null si fait inexistant", async () => {
      mockStorage.updateMemoryFact.mockResolvedValue(null);
      const result = await editMemoryFact("nonexistent", { content: "Nope" });
      expect(result).toBeNull();
    });
  });

  describe("forgetFact", () => {
    it("supprime un fait", async () => {
      mockStorage.deleteMemoryFact.mockResolvedValue(true);
      const ok = await forgetFact("1");
      expect(ok).toBe(true);
    });

    it("retourne false si fait inexistant", async () => {
      mockStorage.deleteMemoryFact.mockResolvedValue(false);
      const ok = await forgetFact("nonexistent");
      expect(ok).toBe(false);
    });
  });

  it("loadMemoryRelationships retourne les relations", async () => {
    mockStorage.getMemoryRelationships.mockResolvedValue([{ sourceId: "1", targetId: "2", type: "related", createdAt: "" }]);
    const rels = await loadMemoryRelationships();
    expect(rels).toHaveLength(1);
  });

  describe("updateProfile", () => {
    it("met à jour le profil", async () => {
      mockStorage.getMemory.mockResolvedValue({ facts: [], relationships: [], profile: { name: "Mattia", preferences: ["TypeScript"] } });
      mockStorage.touchMemoryFact.mockResolvedValue(undefined);
      const result = await updateProfile({ name: "Mattia P.", preferences: ["TypeScript", "React"] });
      expect(result.profile.name).toBe("Mattia P.");
    });

    it("rejette si préférences non tableau", async () => {
      await expect(updateProfile({ preferences: "pas tableau" as never })).rejects.toThrow();
    });
  });
});
