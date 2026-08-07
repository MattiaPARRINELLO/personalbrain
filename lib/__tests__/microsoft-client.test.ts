import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks hoistés (accessibles depuis vi.mock factory + tests)
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
  createMicrosoftAuthUrl,
  loadMicrosoftTokens,
  isMicrosoftLinked,
  getMicrosoftTokensFromCode,
  getMicrosoftAccessToken,
} from "../microsoft-client";

const ORIGINAL_ENV = { ...process.env };

function setEnv() {
  process.env.MICROSOFT_CLIENT_ID = "test-id";
  process.env.MICROSOFT_CLIENT_SECRET = "test-secret";
  process.env.MICROSOFT_REDIRECT_URI = "http://localhost:3000/api/auth/microsoft/callback";
}

describe("microsoft-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    setEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  describe("createMicrosoftAuthUrl", () => {
    it("should throw when env vars are missing", () => {
      process.env.MICROSOFT_CLIENT_ID = "";
      expect(() => createMicrosoftAuthUrl("state")).toThrow(
        "MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET et MICROSOFT_REDIRECT_URI doivent etre configures",
      );
    });

    it("should build the authorize URL with scopes and state", () => {
      const url = createMicrosoftAuthUrl("my-state");
      expect(url).toContain("login.microsoftonline.com/common/oauth2/v2.0/authorize");
      expect(url).toContain("client_id=test-id");
      expect(url).toContain("state=my-state");
      expect(url).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fmicrosoft%2Fcallback");
      expect(url).toContain("scope=");
    });
  });

  describe("loadMicrosoftTokens", () => {
    it("should return null when the token file does not exist", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const tokens = await loadMicrosoftTokens();
      expect(tokens).toBeNull();
    });

    it("should parse and return tokens when the file exists", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({ access_token: "abc", refresh_token: "def" }),
      );

      const tokens = await loadMicrosoftTokens();
      expect(tokens?.access_token).toBe("abc");
      expect(tokens?.refresh_token).toBe("def");
    });
  });

  describe("isMicrosoftLinked", () => {
    it("should return false when no token file exists", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      expect(await isMicrosoftLinked()).toBe(false);
    });

    it("should return true when tokens have a refresh_token", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ refresh_token: "valid" }));

      expect(await isMicrosoftLinked()).toBe(true);
    });

    it("should return false when tokens lack a refresh_token", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ access_token: "test" }));

      expect(await isMicrosoftLinked()).toBe(false);
    });
  });

  describe("getMicrosoftTokensFromCode", () => {
    it("should throw when the token response has no refresh_token", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ access_token: "abc" }),
        }),
      );

      await expect(getMicrosoftTokensFromCode("code")).rejects.toThrow(
        "Aucun refresh token recu",
      );
    });

    it("should throw on HTTP error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => "invalid_grant",
        }),
      );

      await expect(getMicrosoftTokensFromCode("code")).rejects.toThrow(
        "Microsoft token error 400",
      );
    });

    it("should return tokens on success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ access_token: "abc", refresh_token: "def" }),
        }),
      );

      const tokens = await getMicrosoftTokensFromCode("code");
      expect(tokens.access_token).toBe("abc");
      expect(tokens.refresh_token).toBe("def");
    });
  });

  describe("getMicrosoftAccessToken", () => {
    beforeEach(() => {
      vi.unstubAllGlobals();
    });

    it("should throw if no tokens exist", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      await expect(getMicrosoftAccessToken()).rejects.toThrow("non lie");
    });

    it("should return the stored access token when not expired", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          access_token: "valid",
          refresh_token: "refresh",
          expiry_date: Date.now() + 3_600_000,
        }),
      );

      expect(await getMicrosoftAccessToken()).toBe("valid");
    });

    it("should refresh the token when expired", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          access_token: "expired",
          refresh_token: "refresh",
          expiry_date: Date.now() - 60_000,
        }),
      );
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ access_token: "refreshed", expires_in: 3600 }),
        }),
      );

      expect(await getMicrosoftAccessToken()).toBe("refreshed");
    });

    it("should throw after max retries when refresh fails", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          access_token: "expired",
          refresh_token: "refresh",
          expiry_date: Date.now() - 60_000,
        }),
      );
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => "invalid_grant",
        }),
      );

      await expect(getMicrosoftAccessToken()).rejects.toThrow(
        "a echoue apres 3 tentatives",
      );
    });
  });
});
