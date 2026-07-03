import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mock fs BEFORE importing the module under test (vi.mock is hoisted)
// ---------------------------------------------------------------------------
const mockReadFile: Mock = vi.fn();

vi.mock("fs", () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import {
  createOAuth2Client,
  loadTokens,
  isGoogleLinked,
} from "../google-client";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
const ORIGINAL_ENV = { ...process.env };

describe("google-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  // -----------------------------------------------------------------------
  // createOAuth2Client
  // -----------------------------------------------------------------------
  describe("createOAuth2Client", () => {
    it("should throw when env vars are missing", () => {
      process.env.GOOGLE_CLIENT_ID = "";
      process.env.GOOGLE_CLIENT_SECRET = "";
      process.env.GOOGLE_REDIRECT_URI = "";

      expect(() => createOAuth2Client()).toThrow(
        "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI doivent etre configures",
      );
    });

    it("should return an OAuth2 client when env vars are set", () => {
      process.env.GOOGLE_CLIENT_ID = "test-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";
      process.env.GOOGLE_REDIRECT_URI =
        "http://localhost:3000/api/auth/google/callback";

      const client = createOAuth2Client();
      expect(client).toBeDefined();
      expect(client.constructor.name).toMatch(/^OAuth2/);
    });
  });

  // -----------------------------------------------------------------------
  // loadTokens
  // -----------------------------------------------------------------------
  describe("loadTokens", () => {
    it("should return null when the token file does not exist", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const tokens = await loadTokens("gmail");
      expect(tokens).toBeNull();
    });

    it("should parse and return tokens when the file exists", async () => {
      const tokenData = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expiry_date: Date.now() + 3_600_000,
      };
      mockReadFile.mockResolvedValue(JSON.stringify(tokenData));

      const tokens = await loadTokens("calendar");
      expect(tokens).not.toBeNull();
      expect(tokens!.access_token).toBe("test-access-token");
      expect(tokens!.refresh_token).toBe("test-refresh-token");
    });
  });

  // -----------------------------------------------------------------------
  // isGoogleLinked
  // -----------------------------------------------------------------------
  describe("isGoogleLinked", () => {
    it("should return false when no token file exists", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const linked = await isGoogleLinked("gmail");
      expect(linked).toBe(false);
    });

    it("should return true when tokens have a refresh_token", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          access_token: "test",
          refresh_token: "valid-refresh-token",
        }),
      );

      const linked = await isGoogleLinked("gmail");
      expect(linked).toBe(true);
    });

    it("should return false when tokens lack a refresh_token", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          access_token: "test",
          // no refresh_token
        }),
      );

      const linked = await isGoogleLinked("gmail");
      expect(linked).toBe(false);
    });
  });
});
