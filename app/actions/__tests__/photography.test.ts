import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  getPhotoShoots: vi.fn(),
  addPhotoShoot: vi.fn(),
  updatePhotoShoot: vi.fn(),
  deletePhotoShoot: vi.fn(),
  logActivity: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { loadPhotoShoots, createPhotoShoot, editPhotoShoot, removePhotoShoot } = await import("@/app/actions/photography");

describe("photography actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loadPhotoShoots retourne les shoots", async () => {
    mockStorage.getPhotoShoots.mockResolvedValue({ shoots: [] });
    const result = await loadPhotoShoots();
    expect(result.shoots).toEqual([]);
  });

  it("createPhotoShoot crée un shoot valide", async () => {
    const mockShoot = { id: "1", title: "Mariage", date: "2026-09-15", client: "Martin", status: "upcoming", createdAt: "", updatedAt: "" };
    mockStorage.addPhotoShoot.mockResolvedValue(mockShoot);
    const result = await createPhotoShoot({ title: "Mariage", date: "2026-09-15", client: "Martin" });
    expect(result.title).toBe("Mariage");
    expect(mockStorage.logActivity).toHaveBeenCalled();
  });

  it("createPhotoShoot rejette un titre vide", async () => {
    await expect(createPhotoShoot({ title: "  ", date: "2026-09-15", client: "Martin" })).rejects.toThrow("Titre requis");
  });

  it("editPhotoShoot modifie un shoot", async () => {
    mockStorage.updatePhotoShoot.mockResolvedValue({ id: "1", title: "Updated", date: "2026-09-15", client: "Martin", status: "done", createdAt: "", updatedAt: "" });
    const result = await editPhotoShoot("1", { status: "done" });
    expect(result).not.toBeNull();
    expect(result!.status).toBe("done");
  });

  it("editPhotoShoot rejette un champ inattendu (strict)", async () => {
    await expect(editPhotoShoot("1", { unknown: true } as never)).rejects.toThrow();
  });

  it("removePhotoShoot supprime un shoot", async () => {
    mockStorage.deletePhotoShoot.mockResolvedValue(true);
    const ok = await removePhotoShoot("1");
    expect(ok).toBe(true);
  });

  it("removePhotoShoot rejette un id vide", async () => {
    await expect(removePhotoShoot("")).rejects.toThrow("Identifiant requis");
  });
});
