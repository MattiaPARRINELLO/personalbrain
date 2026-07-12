import { describe, it, expect, vi } from "vitest";

const mockGetActivity = vi.fn();

vi.mock("@/lib/storage", () => ({ getActivity: mockGetActivity }));

const { loadActivity } = await import("@/app/actions/activity");

describe("activity action", () => {
  it("loadActivity appelle getActivity avec la limite", async () => {
    mockGetActivity.mockResolvedValue([]);
    const result = await loadActivity(10);
    expect(mockGetActivity).toHaveBeenCalledWith(10);
    expect(result).toEqual([]);
  });

  it("loadActivity utilise la limite par défaut de 50", async () => {
    mockGetActivity.mockResolvedValue([]);
    await loadActivity();
    expect(mockGetActivity).toHaveBeenCalledWith(50);
  });
});
