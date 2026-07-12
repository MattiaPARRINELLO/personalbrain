import { describe, it, expect, beforeEach, vi } from "vitest";

const mockLoadTokens = vi.fn();
const mockGetGoogleClient = vi.fn();

vi.mock("@/lib/google-client", () => ({
  loadTokens: mockLoadTokens,
  getGoogleClient: mockGetGoogleClient,
}));

const { checkGoogleHealth } = await import("@/lib/google-health");

describe("google-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne unhealth si aucun token n'existe", async () => {
    mockLoadTokens.mockResolvedValue(null);
    const result = await checkGoogleHealth();
    expect(result.gmail.ok).toBe(false);
    expect(result.calendar.ok).toBe(false);
  });

  it("retourne ok et expiresIn pour les comptes liés", async () => {
    const futureExpiry = Date.now() + 3600_000;
    mockLoadTokens.mockResolvedValue({
      refresh_token: "rtoken",
      expiry_date: futureExpiry,
    });
    const result = await checkGoogleHealth();
    expect(result.gmail.ok).toBe(true);
    expect(result.gmail.expiresIn).toBeGreaterThan(0);
    expect(result.calendar.ok).toBe(true);
  });

  it("rafraîchit le token si proche de l'expiration", async () => {
    const nearExpiry = Date.now() + 10_000; // < REFRESH_THRESHOLD_MS
    mockLoadTokens.mockResolvedValue({
      refresh_token: "rtoken",
      expiry_date: nearExpiry,
    });
    mockGetGoogleClient.mockResolvedValue({});

    const result = await checkGoogleHealth();
    expect(mockGetGoogleClient).toHaveBeenCalledWith("gmail");
    expect(mockGetGoogleClient).toHaveBeenCalledWith("calendar");
    expect(result.gmail.ok).toBe(true);
  });

  it("ne casse pas si getGoogleClient lance une erreur", async () => {
    mockLoadTokens.mockResolvedValue({
      refresh_token: "rtoken",
      expiry_date: Date.now() + 1000,
    });
    mockGetGoogleClient.mockRejectedValue(new Error("Network error"));
    const result = await checkGoogleHealth();
    expect(result.gmail.ok).toBe(false);
    expect(result.calendar.ok).toBe(false);
  });
});
