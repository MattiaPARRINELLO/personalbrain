import { beforeEach, describe, it, expect, vi } from "vitest";

const mockGetDemoCalls = vi.fn();
const mockRequireSession = vi.fn().mockResolvedValue({ userId: "owner" });

vi.mock("@/lib/storage", () => ({ getDemoCalls: mockGetDemoCalls }));
vi.mock("@/lib/session", () => ({ requireSession: mockRequireSession }));

const { loadDemoCalls } = await import("@/app/actions/demo-calls");

describe("demo-calls action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ userId: "owner" });
  });

  it("charge les appels avec la limite demandée", async () => {
    mockGetDemoCalls.mockResolvedValue([]);
    await loadDemoCalls(25);
    expect(mockRequireSession).toHaveBeenCalledOnce();
    expect(mockGetDemoCalls).toHaveBeenCalledWith(25);
  });

  it("utilise une limite par défaut de 1000", async () => {
    mockGetDemoCalls.mockResolvedValue([]);
    await loadDemoCalls();
    expect(mockGetDemoCalls).toHaveBeenCalledWith(1000);
  });

  it("ne lit aucun appel sans session", async () => {
    mockRequireSession.mockRejectedValue(new Error("Non authentifié"));
    await expect(loadDemoCalls()).rejects.toThrow("Non authentifié");
    expect(mockGetDemoCalls).not.toHaveBeenCalled();
  });
});
