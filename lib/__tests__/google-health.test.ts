import { describe, it, expect } from "vitest";
import { deriveGoogleHealth } from "../google-health";

// Seuils documentés dans lib/google-health.ts (constantes privées) :
// expiration Testing = 7 jours, alerte à partir de 5,5 jours.
const EXPIRY_DAYS = 7;
const WARN_AFTER_DAYS = 5.5;
const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

describe("deriveGoogleHealth", () => {
  it("should report unlinked when there is no refresh token", () => {
    const state = deriveGoogleHealth({
      hasRefreshToken: false,
      brokenSinceMs: null,
      obtainedAtMs: NOW - 2 * DAY,
      nowMs: NOW,
    });
    expect(state.linked).toBe(false);
    expect(state.broken).toBe(false);
    expect(state.expiringSoon).toBe(false);
    expect(state.ageDays).toBeNull();
  });

  it("should report broken when a refresh failed", () => {
    const state = deriveGoogleHealth({
      hasRefreshToken: true,
      brokenSinceMs: NOW - 60_000,
      obtainedAtMs: NOW - DAY,
      nowMs: NOW,
    });
    expect(state.linked).toBe(true);
    expect(state.broken).toBe(true);
    expect(state.expiringSoon).toBe(false);
  });

  it("should report a recent link as healthy", () => {
    const state = deriveGoogleHealth({
      hasRefreshToken: true,
      brokenSinceMs: null,
      obtainedAtMs: NOW - 2 * DAY,
      nowMs: NOW,
    });
    expect(state.linked).toBe(true);
    expect(state.broken).toBe(false);
    expect(state.expiringSoon).toBe(false);
    expect(state.ageDays).toBeCloseTo(2);
  });

  it("should report expiringSoon near the 7-day testing limit", () => {
    const state = deriveGoogleHealth({
      hasRefreshToken: true,
      brokenSinceMs: null,
      obtainedAtMs: NOW - (EXPIRY_DAYS - 1) * DAY,
      nowMs: NOW,
    });
    expect(state.expiringSoon).toBe(true);
    expect(state.ageDays).toBeCloseTo(EXPIRY_DAYS - 1);
  });

  it("should not report expiringSoon before the warning threshold", () => {
    const state = deriveGoogleHealth({
      hasRefreshToken: true,
      brokenSinceMs: null,
      obtainedAtMs: NOW - (WARN_AFTER_DAYS - 0.5) * DAY,
      nowMs: NOW,
    });
    expect(state.expiringSoon).toBe(false);
  });

  it("should refuse to report expiringSoon when broken (broken wins)", () => {
    const state = deriveGoogleHealth({
      hasRefreshToken: true,
      brokenSinceMs: NOW - 60_000,
      obtainedAtMs: NOW - 6.5 * DAY,
      nowMs: NOW,
    });
    expect(state.broken).toBe(true);
    expect(state.expiringSoon).toBe(false);
  });

  it("should handle an unknown link date without expiringSoon", () => {
    const state = deriveGoogleHealth({
      hasRefreshToken: true,
      brokenSinceMs: null,
      obtainedAtMs: null,
      nowMs: NOW,
    });
    expect(state.linked).toBe(true);
    expect(state.expiringSoon).toBe(false);
    expect(state.ageDays).toBeNull();
  });
});