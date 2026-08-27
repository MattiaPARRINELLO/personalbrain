import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import {
  setServerCached,
  getServerCached,
  invalidateServerCache,
} from "../server-cache";
import {
  markGoogleBroken,
  clearGoogleBroken,
  getBrokenSince,
} from "../google-client";

const DATA_DIR = path.join(process.cwd(), "data");
const HEALTH_FILE = path.join(DATA_DIR, ".google-health.json");
const CACHE_FILE = path.join(DATA_DIR, "server-cache.json");

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf-8");
  } catch {
    return null;
  }
}

let healthBackup: string | null = null;
let cacheBackup: string | null = null;

describe("google health cache invalidation", () => {
  it("should invalidate the health endpoint cache when a break is recorded", async () => {
    healthBackup = await readIfExists(HEALTH_FILE);
    cacheBackup = await readIfExists(CACHE_FILE);
    // Repart d'un état connu, même si un autre process (dev server) a posé
    // un marqueur réel entre-temps.
    await fs.rm(HEALTH_FILE, { force: true });

    setServerCached("google:health", { gmail: { broken: false } }, 60_000);
    expect(getServerCached("google:health")).toBeDefined();

    await markGoogleBroken("gmail");
    expect(getServerCached("google:health")).toBeUndefined();
    expect(await getBrokenSince("gmail")).not.toBeNull();

    await clearGoogleBroken("gmail");
    expect(await getBrokenSince("gmail")).toBeNull();
  });

  afterAll(async () => {
    // Restaure l'état réel des fichiers data/ touchés par le test.
    if (healthBackup === null) {
      await fs.rm(HEALTH_FILE, { force: true });
    } else {
      await fs.writeFile(HEALTH_FILE, healthBackup, "utf-8");
    }
    if (cacheBackup === null) {
      await fs.rm(CACHE_FILE, { force: true });
    } else {
      await fs.writeFile(CACHE_FILE, cacheBackup, "utf-8");
    }
    invalidateServerCache("google:health");
  });
});