import { readFileSync } from "fs";
import { promises as fs } from "fs";
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

// Écritures disque sérialisées (mutex) : évite la corruption du fichier en
// cas d'écritures concurrentes, sans bloquer l'event loop.
let writeQueue: Promise<void> = Promise.resolve();

function loadFromDisk() {
  // Lecture sync limitée au premier chargement, fichier de petite taille.
  try {
    const raw = readFileSync(CACHE_FILE, "utf-8");
    memoryCache = JSON.parse(raw) as Record<string, CacheEntry<unknown>>;
  } catch {
    memoryCache = {};
  }
}

function scheduleSave() {
  const payload = JSON.stringify(memoryCache, null, 2);
  writeQueue = writeQueue
    .then(async () => {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      const tmpPath = `${CACHE_FILE}.tmp`;
      await fs.writeFile(tmpPath, payload, "utf-8");
      await fs.rename(tmpPath, CACHE_FILE);
    })
    .catch((err) => {
      console.warn("[server-cache] Écriture disque échouée:", err);
    });
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
    scheduleSave();
    return undefined;
  }
  return entry.data as T;
}

export function setServerCached<T>(key: string, data: T, ttlMs: number) {
  ensureLoaded();
  memoryCache[key] = { data, createdAt: Date.now(), ttlMs };
  scheduleSave();
}

export function invalidateServerCache(key: string) {
  ensureLoaded();
  delete memoryCache[key];
  scheduleSave();
}

export function invalidateServerCachePattern(pattern: RegExp) {
  ensureLoaded();
  for (const key of Object.keys(memoryCache)) {
    if (pattern.test(key)) delete memoryCache[key];
  }
  scheduleSave();
}
