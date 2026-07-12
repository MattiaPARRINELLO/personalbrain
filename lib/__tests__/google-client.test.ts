import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks hoistés (accessibles depuis vi.mock factory + tests)
// ---------------------------------------------------------------------------
const mockReadFile: Mock = vi.fn();

const { mockSetCredentials, mockRefreshAccessToken } = vi.hoisted(() => ({
  mockSetCredentials: vi.fn(),
  mockRefreshAccessToken: vi.fn(),
}));

vi.mock("google-auth-library", () => {
  class MockOAuth2Client {
    constructor(...args: unknown[]) {}
    setCredentials = mockSetCredentials;
    refreshAccessToken = mockRefreshAccessToken;
  }
  return { OAuth2Client: MockOAuth2Client };
});

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

  // -----------------------------------------------------------------------
  // saveTokens
  // -----------------------------------------------------------------------
  describe("saveTokens", () => {
    it("should write tokens atomically (tmp + rename)", async () => {
      const fs = await import("fs");
      const { saveTokens } = await import("../google-client");
      const tokens = { access_token: "abc", refresh_token: "def" };
      await saveTokens("gmail", tokens);

      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(".tmp"),
        expect.any(String),
        "utf-8",
      );
      expect(fs.promises.rename).toHaveBeenCalledWith(
        expect.stringContaining(".tmp"),
        expect.not.stringContaining(".tmp"),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getGoogleClient
  // -----------------------------------------------------------------------
  describe("getGoogleClient", () => {
    beforeEach(() => {
      mockSetCredentials.mockClear();
      mockRefreshAccessToken.mockClear();
      process.env.GOOGLE_CLIENT_ID = "id";
      process.env.GOOGLE_CLIENT_SECRET = "secret";
      process.env.GOOGLE_REDIRECT_URI = "https://redirect";
    });

    it("should throw if no tokens exist", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));
      const { getGoogleClient } = await import("../google-client");
      await expect(getGoogleClient("gmail")).rejects.toThrow("non lie");
    });

    it("should return client when tokens are valid and not expired", async () => {
      const future = Date.now() + 3600_000;
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          access_token: "valid",
          refresh_token: "refresh",
          expiry_date: future,
        }),
      );
      const { getGoogleClient } = await import("../google-client");
      const client = await getGoogleClient("gmail");
      expect(client).toBeDefined();
      expect(mockSetCredentials).toHaveBeenCalled();
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    it("should refresh token if expired", async () => {
      const past = Date.now() - 3600_000;
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          access_token: "expired",
          refresh_token: "refresh",
          expiry_date: past,
        }),
      );
      mockRefreshAccessToken.mockResolvedValue({
        credentials: { access_token: "refreshed", expiry_date: Date.now() + 3600_000 },
      });

      const { getGoogleClient } = await import("../google-client");
      const client = await getGoogleClient("gmail");
      expect(client).toBeDefined();
      expect(mockRefreshAccessToken).toHaveBeenCalled();
      expect(mockSetCredentials).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: "refreshed" }),
      );
    });

    it("should throw after max retries when refresh fails", async () => {
      const past = Date.now() - 3600_000;
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          access_token: "expired",
          refresh_token: "refresh",
          expiry_date: past,
        }),
      );
      mockRefreshAccessToken.mockRejectedValue(new Error("invalid_grant"));

      const { getGoogleClient } = await import("../google-client");
      await expect(getGoogleClient("gmail")).rejects.toThrow(
        "a echoue apres 3 tentatives",
      );
      // Vérifie que le retry a été tenté MAX_RETRIES fois
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(3);
    });
  });

  // -----------------------------------------------------------------------
  // getGmailClient / getCalendarClient
  // -----------------------------------------------------------------------
  describe("getGmailClient / getCalendarClient", () => {
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = "id";
      process.env.GOOGLE_CLIENT_SECRET = "secret";
      process.env.GOOGLE_REDIRECT_URI = "https://redirect";
      const future = Date.now() + 3600_000;
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          access_token: "valid",
          refresh_token: "refresh",
          expiry_date: future,
        }),
      );
    });

    it("getGmailClient should call getGoogleClient with gmail", async () => {
      const { getGmailClient } = await import("../google-client");
      const client = await getGmailClient();
      expect(client).toBeDefined();
    });

    it("getCalendarClient should call getGoogleClient with calendar", async () => {
      const { getCalendarClient } = await import("../google-client");
      const client = await getCalendarClient();
      expect(client).toBeDefined();
    });
  });
});
