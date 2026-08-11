import { describe, it, expect, afterEach, vi } from "vitest";
import { isAuthorizedCron } from "./lib/cron-auth";

function makeRequest(secretHeader?: string, authHeader?: string): Request {
  const headers = new Headers();
  if (secretHeader) headers.set("x-cron-secret", secretHeader);
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("http://localhost/api/cron/reminders", { method: "POST", headers });
}

describe("isAuthorizedCron", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuse tout appel en production sans CRON_SECRET configuré", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    expect(isAuthorizedCron(makeRequest())).toBe(false);
    expect(isAuthorizedCron(makeRequest("nimporte-quoi"))).toBe(false);
  });

  it("autorise en développement sans secret (workflow local)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CRON_SECRET", "");
    expect(isAuthorizedCron(makeRequest())).toBe(true);
  });

  it("accepte le header x-cron-secret correct", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "secret-test");
    expect(isAuthorizedCron(makeRequest("secret-test"))).toBe(true);
  });

  it("accepte le header Authorization Bearer correct", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "secret-test");
    expect(isAuthorizedCron(makeRequest(undefined, "Bearer secret-test"))).toBe(true);
  });

  it("refuse un secret incorrect ou absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "secret-test");
    expect(isAuthorizedCron(makeRequest("mauvais"))).toBe(false);
    expect(isAuthorizedCron(makeRequest())).toBe(false);
    expect(isAuthorizedCron(makeRequest(undefined, "Bearer mauvais"))).toBe(false);
  });

  it("refuse même en dev si CRON_SECRET est défini mais le header est faux", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CRON_SECRET", "secret-test");
    expect(isAuthorizedCron(makeRequest("mauvais"))).toBe(false);
    expect(isAuthorizedCron(makeRequest("secret-test"))).toBe(true);
  });
});
