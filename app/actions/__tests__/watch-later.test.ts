import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  addWatchLaterItem: vi.fn(),
  deleteWatchLaterItem: vi.fn(),
  getWatchLater: vi.fn(),
  reorderWatchLaterItems: vi.fn(),
  updateWatchLaterItem: vi.fn(),
  autoSummarize: vi.fn(),
  logActivity: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createWatchLaterItem, loadWatchLater, editWatchLaterItem, removeWatchLaterItem, reorderWatchLater, summarizeWatchLaterItem } = await import("@/app/actions/watch-later");

describe("watch-later actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getWatchLater.mockResolvedValue({ items: [] });
  });

  it("loadWatchLater retourne les données", async () => {
    const result = await loadWatchLater();
    expect(result.items).toEqual([]);
  });

  it("createWatchLaterItem crée un item", async () => {
    mockStorage.addWatchLaterItem.mockResolvedValue({ id: "1", url: "https://example.com", title: "Test", category: "article", read: false, createdAt: "" });
    mockStorage.autoSummarize.mockResolvedValue({ summary: "", tags: [] });

    const item = await createWatchLaterItem({ url: "https://example.com", title: "Test" });
    expect(item.title).toBe("Test");
    expect(mockStorage.logActivity).toHaveBeenCalled();
  });

  it("createWatchLaterItem rejette une URL invalide", async () => {
    await expect(createWatchLaterItem({ url: "pas-une-url", title: "Test" })).rejects.toThrow("URL invalide");
  });

  it("editWatchLaterItem modifie un item", async () => {
    mockStorage.updateWatchLaterItem.mockResolvedValue({ id: "1", url: "https://example.com", title: "Updated", category: "video", read: false, createdAt: "" });
    const r = await editWatchLaterItem("1", { title: "Updated", category: "video" });
    expect(r).not.toBeNull();
    expect(r!.title).toBe("Updated");
  });

  it("editWatchLaterItem rejette un id vide", async () => {
    await expect(editWatchLaterItem("", { title: "Test" })).rejects.toThrow("Identifiant requis");
  });

  it("removeWatchLaterItem supprime un item", async () => {
    mockStorage.deleteWatchLaterItem.mockResolvedValue(true);
    const ok = await removeWatchLaterItem("1");
    expect(ok).toBe(true);
  });

  it("reorderWatchLater réordonne les items", async () => {
    mockStorage.reorderWatchLaterItems.mockResolvedValue(true);
    const ok = await reorderWatchLater(["a", "b"]);
    expect(ok).toBe(true);
  });

  it("reorderWatchLater rejette un tableau vide", async () => {
    await expect(reorderWatchLater([])).rejects.toThrow("Liste d'IDs invalide");
  });

  it("summarizeWatchLaterItem résume un item existant", async () => {
    mockStorage.getWatchLater.mockResolvedValue({ items: [{ id: "1", url: "https://example.com", title: "Test", category: "article", read: false, createdAt: "" }] });
    mockStorage.autoSummarize.mockResolvedValue({ summary: "Résumé", tags: ["tag1"] });
    const result = await summarizeWatchLaterItem("1");
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("Résumé");
  });

  it("summarizeWatchLaterItem retourne null si item inexistant", async () => {
    mockStorage.getWatchLater.mockResolvedValue({ items: [] });
    const result = await summarizeWatchLaterItem("nonexistent");
    expect(result).toBeNull();
  });
});
