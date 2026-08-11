import { describe, it, expect, beforeEach, vi } from "vitest";
import { readJsonSafe } from "@/lib/storage";

vi.mock("@/lib/storage", () => ({
  readJsonSafe: vi.fn(),
  writeJsonAtomic: vi.fn(),
}));

const mockMutateJson = vi.fn();
vi.mock("@/lib/storage-core", () => ({ mutateJson: mockMutateJson }));

const { getConfig, updateConfig, getConfigCachePath, clearConfigCache, getModel } = await import("@/lib/config");

const defaultConfig = {
  models: {
    general: "kimi-k2.6",
    generalAlt: "deepseek-v4-flash",
    code: "kimi-k2.7-code",
    titleModel: "deepseek-v4-flash",
  },
  llm: { temperature: 0.7, maxTokens: 4096 },
  features: { dailyBrief: false, webSearch: true },
  theme: { accentColor: "#a5b4fc" },
};

describe("config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConfigCache();
  });

  it("retourne la config par défaut quand le fichier n'existe pas", async () => {
    vi.mocked(readJsonSafe).mockResolvedValue({});
    const config = await getConfig();
    expect(config).toEqual(defaultConfig);
  });

  it("merge profondément la config stockée avec les défauts", async () => {
    vi.mocked(readJsonSafe).mockResolvedValue({
      models: { general: "custom-model" },
    });
    const config = await getConfig();
    expect(config.models.general).toBe("custom-model");
    expect(config.models.code).toBe("kimi-k2.7-code");
    expect(config.llm.temperature).toBe(0.7);
  });

  it("met en cache la config pendant CACHE_TTL", async () => {
    vi.mocked(readJsonSafe).mockResolvedValue({});
    await getConfig();
    await getConfig();
    expect(readJsonSafe).toHaveBeenCalledTimes(1);
  });

  it("updateConfig écrit et met à jour le cache", async () => {
    vi.mocked(readJsonSafe).mockResolvedValue({});
    mockMutateJson.mockImplementation(async (_file, fallback, mutator) => {
      const data = structuredClone(fallback);
      const res = mutator(data);
      return (res ?? data) as unknown;
    });
    const updated = await updateConfig({
      llm: { temperature: 1.0, maxTokens: 8192 },
    });
    expect(updated.llm.temperature).toBe(1.0);
    expect(updated.llm.maxTokens).toBe(8192);
    expect(mockMutateJson).toHaveBeenCalledWith("config.json", expect.anything(), expect.any(Function));
  });

  it("getConfigCachePath retourne le chemin attendu", () => {
    const p = getConfigCachePath();
    expect(p).toContain("config.json");
  });

  it("getModel retourne les modèles code pour le contexte code", async () => {
    vi.mocked(readJsonSafe).mockResolvedValue({});
    const result = await getModel("code");
    expect(result.primary).toBe("kimi-k2.7-code");
    expect(result.alt).toBe("kimi-k2.7-code");
  });

  it("getModel retourne general et generalAlt pour le contexte general", async () => {
    vi.mocked(readJsonSafe).mockResolvedValue({});
    const result = await getModel("general");
    expect(result.primary).toBe("kimi-k2.6");
    expect(result.alt).toBe("deepseek-v4-flash");
  });
});
