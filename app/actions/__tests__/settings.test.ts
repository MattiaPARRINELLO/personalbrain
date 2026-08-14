import { describe, it, expect, beforeEach, vi } from "vitest";

const mockConfig = {
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
};

const mockSubs = {
  getSubscriptions: vi.fn(),
};

const mockModels = {
  fetchAvailableModels: vi.fn(),
};

vi.mock("@/lib/config", () => mockConfig);
vi.mock("@/lib/push-subscriptions", () => mockSubs);
vi.mock("@/lib/ai-providers/models", () => mockModels);
vi.mock("@/lib/session", () => ({ requireSession: vi.fn().mockResolvedValue({ userId: "test-user" }) }));

const { loadRuntimeInfo, updateModels } = await import("@/app/actions/settings");

const baseConfig = {
  models: {
    general: "deepseek-v4-pro",
    generalAlt: "kimi-k2.6",
    code: "kimi-k2.7-code",
    titleModel: "deepseek-v4-flash",
  },
  llm: { temperature: 0.7, maxTokens: 4096 },
  features: { dailyBrief: true, webSearch: true },
  theme: { accentColor: "#a5b4fc" },
};

const available = ["deepseek-v4-pro", "deepseek-v4-flash", "kimi-k2.6", "kimi-k2.7-code", "qwen3.7-max"];

describe("settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.getConfig.mockResolvedValue(baseConfig);
    mockSubs.getSubscriptions.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    mockModels.fetchAvailableModels.mockResolvedValue(available);
  });

  describe("loadRuntimeInfo", () => {
    it("retourne les modèles configurés, la liste disponible et le nombre d'appareils push", async () => {
      const info = await loadRuntimeInfo();
      expect(info.models).toEqual({
        general: "deepseek-v4-pro",
        generalAlt: "kimi-k2.6",
        code: "kimi-k2.7-code",
      });
      expect(info.availableModels).toEqual(available);
      expect(info.pushCount).toBe(2);
      expect(info.features.dailyBrief).toBe(true);
    });
  });

  describe("updateModels", () => {
    it("sauvegarde les modèles choisis via updateConfig", async () => {
      mockConfig.updateConfig.mockResolvedValue(baseConfig);
      const result = await updateModels({
        general: "qwen3.7-max",
        generalAlt: "deepseek-v4-flash",
        code: "kimi-k2.7-code",
      });
      expect(mockConfig.updateConfig).toHaveBeenCalledWith({
        models: { general: "qwen3.7-max", generalAlt: "deepseek-v4-flash", code: "kimi-k2.7-code" },
      });
      expect(result).toEqual({
        general: "qwen3.7-max",
        generalAlt: "deepseek-v4-flash",
        code: "kimi-k2.7-code",
      });
    });

    it("rejette un modèle absent de la liste de l'API", async () => {
      await expect(
        updateModels({ general: "modele-inexistant", generalAlt: "kimi-k2.6", code: "kimi-k2.7-code" })
      ).rejects.toThrow("Modele indisponible : modele-inexistant");
      expect(mockConfig.updateConfig).not.toHaveBeenCalled();
    });

    it("rejette un champ vide après trim", async () => {
      await expect(
        updateModels({ general: "  ", generalAlt: "kimi-k2.6", code: "kimi-k2.7-code" })
      ).rejects.toThrow("Modele requis");
    });

    it("rejette un champ inattendu (schéma strict)", async () => {
      await expect(
        updateModels({ general: "kimi-k2.6", generalAlt: "kimi-k2.6", code: "kimi-k2.7-code", extra: "x" } as never)
      ).rejects.toThrow(/extra/);
    });
  });
});
