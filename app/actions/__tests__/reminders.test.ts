import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  addReminder: vi.fn(),
  deleteReminder: vi.fn(),
  getReminders: vi.fn(),
  updateReminder: vi.fn(),
  logActivity: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createReminder, loadReminders, editReminder, removeReminder, markReminderStatus } = await import("@/app/actions/reminders");

describe("reminders actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getReminders.mockResolvedValue({ reminders: [] });
  });

  it("loadReminders retourne les reminders", async () => {
    mockStorage.getReminders.mockResolvedValue({
      reminders: [{ id: "1", title: "Test", dueAt: "2026-07-15T10:00:00Z", status: "pending", createdAt: "", updatedAt: "", notifiedAt: null }],
    });
    const result = await loadReminders();
    expect(result.reminders).toHaveLength(1);
  });

  it("createReminder crée un reminder avec les champs requis", async () => {
    mockStorage.addReminder.mockResolvedValue({ id: "new-1", title: "Mon rappel", dueAt: "2026-07-15T10:00:00Z", status: "pending", createdAt: "", updatedAt: "", notifiedAt: null });
    const r = await createReminder({ title: "Mon rappel", dueAt: "2026-07-15T10:00:00Z" });
    expect(r.title).toBe("Mon rappel");
    expect(mockStorage.logActivity).toHaveBeenCalled();
  });

  it("createReminder rejette un titre vide", async () => {
    await expect(createReminder({ title: "  ", dueAt: "2026-07-15T10:00:00Z" })).rejects.toThrow("Titre requis");
  });

  it("editReminder valide les champs", async () => {
    mockStorage.updateReminder.mockResolvedValue({ id: "1", title: "Updated", dueAt: "2026-07-15T10:00:00Z", status: "pending", createdAt: "", updatedAt: "", notifiedAt: null });
    const r = await editReminder("1", { title: "Updated" });
    expect(r).not.toBeNull();
    expect(r!.title).toBe("Updated");
  });

  it("editReminder rejette un statut invalide", async () => {
    await expect(editReminder("1", { status: "invalid" as never })).rejects.toThrow();
  });

  it("removeReminder supprime un reminder", async () => {
    mockStorage.deleteReminder.mockResolvedValue(true);
    const ok = await removeReminder("1");
    expect(ok).toBe(true);
    expect(mockStorage.logActivity).toHaveBeenCalled();
  });

  it("removeReminder rejette un id vide", async () => {
    await expect(removeReminder("")).rejects.toThrow("Identifiant requis");
  });

  it("markReminderStatus change le statut", async () => {
    mockStorage.updateReminder.mockResolvedValue({ id: "1", title: "Test", dueAt: "", status: "done", createdAt: "", updatedAt: "", notifiedAt: null });
    const r = await markReminderStatus("1", "done");
    expect(r).not.toBeNull();
    expect(r!.status).toBe("done");
  });

  it("markReminderStatus rejette un statut invalide", async () => {
    await expect(markReminderStatus("1", "invalid" as never)).rejects.toThrow("Statut invalide");
  });
});
