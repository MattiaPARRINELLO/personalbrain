import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  exchangeAuthorizationCode,
  GOOGLE_CODE_TIMEOUT_MS,
} from "../google-client";

const ORIGINAL_ENV = { ...process.env };

function fakeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("exchangeAuthorizationCode", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("should return tokens with a computed expiry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        fakeResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600 })
      )
    );

    const tokens = await exchangeAuthorizationCode("the-code", "https://app/cb");
    expect(tokens.access_token).toBe("at");
    expect(tokens.refresh_token).toBe("rt");
    expect(tokens.expiry_date).toBeGreaterThan(Date.now());
    expect(tokens.expiry_date).toBeLessThan(Date.now() + 4000 * 1000);
  });

  it("should throw a clean error when Google refuses the code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        fakeResponse({ error: "invalid_grant", error_description: "Code déjà utilisé" }, false, 400)
      )
    );

    await expect(exchangeAuthorizationCode("used-code", "https://app/cb")).rejects.toThrow(
      "Échange du code Google refusé : Code déjà utilisé"
    );
  });

  it("should send the code with a firm timeout signal (no silent hang)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse({ access_token: "at", refresh_token: "rt", expires_in: 300 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await exchangeAuthorizationCode("c", "https://app/cb");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(AbortSignal.timeout).toBeDefined();
    expect(GOOGLE_CODE_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("should pass exactly one grant_type=authorization_code body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse({ access_token: "at", refresh_token: "rt", expires_in: 300 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await exchangeAuthorizationCode("c", "https://app/cb");

    const body = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("c");
    expect(body.get("redirect_uri")).toBe("https://app/cb");
  });
});