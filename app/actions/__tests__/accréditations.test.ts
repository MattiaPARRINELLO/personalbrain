import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  getAccreditations: vi.fn(),
  addAccreditation: vi.fn(),
  updateAccreditation: vi.fn(),
  deleteAccreditation: vi.fn(),
  saveAccreditations: vi.fn(),
  searchAccreditations: vi.fn(),
  logActivity: vi.fn(),
};

const mockGoogleActions = {
  fetchGmailMessages: vi.fn(),
};

const mockAiProviders = {
  chatCompletion: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);
vi.mock("@/lib/google-actions", () => mockGoogleActions);
vi.mock("@/lib/ai-providers", () => mockAiProviders);
vi.mock("@/lib/config", () => ({
  getModel: vi.fn().mockResolvedValue({ primary: "deepseek-v4-flash", alt: "deepseek-v4-flash" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireSession: vi.fn().mockResolvedValue({ userId: "test-user" }) }));

const {
  loadAccreditations,
  createAccreditation,
  editAccreditation,
  removeAccreditation,
  scanAccreditationsAction,
  generateFollowUpDraft,
} = await import("@/app/actions/accreditations");

describe("accreditations actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loadAccreditations retourne les accréditations", async () => {
    mockStorage.getAccreditations.mockResolvedValue({ accreditations: [] });
    const result = await loadAccreditations();
    expect(result.accreditations).toEqual([]);
  });

  describe("createAccreditation", () => {
    it("crée une accréditation", async () => {
      const mockAcc = { id: "1", artist: "Muse", venue: "Stade", concertDate: "2026-08-01", status: "pending", contactEmail: "", notes: "", createdAt: "", updatedAt: "" };
      mockStorage.addAccreditation.mockResolvedValue(mockAcc);
      const result = await createAccreditation({ artist: "Muse", venue: "Stade", concertDate: "2026-08-01" });
      expect(result.artist).toBe("Muse");
      expect(mockStorage.logActivity).toHaveBeenCalled();
    });

    it("rejette si validation Zod échoue", async () => {
      await expect(createAccreditation({ artist: "", venue: "", concertDate: "" })).rejects.toThrow("Artiste requis");
    });
  });

  describe("editAccreditation", () => {
    it("modifie une accréditation", async () => {
      mockStorage.updateAccreditation.mockResolvedValue({ id: "1", artist: "Muse", venue: "Stade", concertDate: "2026-08-01", status: "accepted", contactEmail: "", notes: "", createdAt: "", updatedAt: "" });
      const result = await editAccreditation("1", { status: "accepted" });
      expect(result).not.toBeNull();
      expect(result!.status).toBe("accepted");
    });

    it("rejette si id invalide", async () => {
      await expect(editAccreditation("", {})).rejects.toThrow("Identifiant requis");
    });

    it("rejette si validation Zod échoue", async () => {
      await expect(editAccreditation("1", { status: "invalid" as never })).rejects.toThrow();
    });
  });

  describe("removeAccreditation", () => {
    it("supprime une accréditation", async () => {
      mockStorage.deleteAccreditation.mockResolvedValue(true);
      const ok = await removeAccreditation("1");
      expect(ok).toBe(true);
      expect(mockStorage.logActivity).toHaveBeenCalled();
    });

    it("rejette si id invalide", async () => {
      await expect(removeAccreditation("")).rejects.toThrow("Identifiant requis");
    });
  });

  describe("scanAccreditationsAction", () => {
    const mockAccreditation = (overrides = {}) => ({
      id: "1", artist: "Artist", venue: "Venue", concertDate: "2025-01-01",
      status: "pending", contactEmail: "", notes: "", createdAt: "", updatedAt: "",
      ...overrides,
    });

    it("crée de nouvelles accréditations depuis les emails", async () => {
      mockGoogleActions.fetchGmailMessages.mockResolvedValue([
        {
          id: "email1",
          subject: "Accréditation pour Muse au Stade de France",
          from: "contact@muse.com",
          snippet: "Concert le 15 juillet 2026",
        },
      ]);
      mockStorage.getAccreditations.mockResolvedValue({ accreditations: [] });
      mockStorage.addAccreditation.mockResolvedValue(mockAccreditation({ id: "new1", artist: "Muse", venue: "Stade de France" }));

      const result = await scanAccreditationsAction();

      expect(result.created).toBe(1);
      expect(mockStorage.addAccreditation).toHaveBeenCalled();
    });

    it("met à jour le statut des accréditations existantes", async () => {
      const existing = mockAccreditation({ artist: "Muse", venue: "Stade", status: "pending" });
      mockGoogleActions.fetchGmailMessages.mockResolvedValue([
        {
          id: "email1",
          subject: "Concert de Muse. au Stade, accepté",
          from: "contact@venue.com",
          snippet: "Nous confirmons votre accréditation",
        },
      ]);
      mockStorage.getAccreditations.mockResolvedValue({ accreditations: [existing] });
      mockStorage.addAccreditation.mockResolvedValue(mockAccreditation());

      await scanAccreditationsAction();

      expect(mockStorage.saveAccreditations).toHaveBeenCalled();
      const saved = mockStorage.saveAccreditations.mock.calls[0][0];
      const updated = saved.accreditations.find((a: { artist: string }) => a.artist === "Muse");
      expect(updated.status).toBe("accepted");
    });

    it("ignore les messages sans artiste identifiable", async () => {
      mockGoogleActions.fetchGmailMessages.mockResolvedValue([
        { id: "email1", subject: "Hello", from: "test@test.com", snippet: "No relevant info" },
      ]);
      mockStorage.getAccreditations.mockResolvedValue({ accreditations: [] });

      const result = await scanAccreditationsAction();

      expect(result.created).toBe(0);
    });
  });

  describe("generateFollowUpDraft", () => {
    it("génère un brouillon de relance", async () => {
      const acc = { id: "1", artist: "Muse", venue: "Stade", concertDate: "2026-07-15", status: "sent", contactEmail: "contact@muse.com", notes: "", createdAt: "", updatedAt: "" };
      mockStorage.getAccreditations.mockResolvedValue({ accreditations: [acc] });
      mockAiProviders.chatCompletion.mockResolvedValue({ content: "Bonjour, suite à ma demande...", toolCalls: [] });

      const draft = await generateFollowUpDraft("1");
      expect(draft).toBe("Bonjour, suite à ma demande...");
    });

    it("rejette si accréditation introuvable", async () => {
      mockStorage.getAccreditations.mockResolvedValue({ accreditations: [] });
      await expect(generateFollowUpDraft("nonexistent")).rejects.toThrow("Accréditation introuvable");
    });
  });
});
