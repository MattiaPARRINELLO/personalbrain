import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

type CacheEntry<T> = {
  data: T;
  createdAt: number;
  ttlMs: number;
};

const CACHE_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "server-cache.json");

let memoryCache: Record<string, CacheEntry<unknown>> = {};
let loaded = false;

function loadFromDisk() {
  try {
    if (existsSync(CACHE_FILE)) {
      const raw = readFileSync(CACHE_FILE, "utf-8");
      memoryCache = JSON.parse(raw) as Record<string, CacheEntry<unknown>>;
    }
  } catch {
    memoryCache = {};
  }
}

function saveToDisk() {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(memoryCache, null, 2), "utf-8");
  } catch {
    /* ignore */
  }
}

function ensureLoaded() {
  if (!loaded) {
    loadFromDisk();
    loaded = true;
  }
}

export function getServerCached<T>(key: string): T | undefined {
  ensureLoaded();
  const entry = memoryCache[key];
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > entry.ttlMs) {
    delete memoryCache[key];
    saveToDisk();
    return undefined;
  }
  return entry.data as T;
}

export function setServerCached<T>(key: string, data: T, ttlMs: number) {
  ensureLoaded();
  memoryCache[key] = { data, createdAt: Date.now(), ttlMs };
  saveToDisk();
}

export function invalidateServerCache(key: string) {
  ensureLoaded();
  delete memoryCache[key];
  saveToDisk();
}

export function invalidateServerCachePattern(pattern: RegExp) {
  ensureLoaded();
  for (const key of Object.keys(memoryCache)) {
    if (pattern.test(key)) delete memoryCache[key];
  }
  saveToDisk();
}
