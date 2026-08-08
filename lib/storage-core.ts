import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

const fileLocks = new Map<string, Promise<void>>();

async function withFileLock<T>(filename: string, fn: () => Promise<T>): Promise<T> {
  const previous = fileLocks.get(filename);
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  fileLocks.set(
    filename,
    previous?.then(() => next) ?? next
  );

  if (previous) {
    try {
      await previous;
    } catch {
      // La promesse précédente gère déjà ses propres erreurs ; on continue.
    }
  }

  try {
    return await fn();
  } finally {
    release();
    if (fileLocks.get(filename) === next) {
      fileLocks.delete(filename);
    }
  }
}

const TRANSIENT_ERROR_CODES = new Set([
  "EACCES",
  "EAGAIN",
  "EBUSY",
  "ENFILE",
  "ENOSPC",
  "ENOTEMPTY",
  "EPERM",
  "ETXTBSY",
  "EWOULDBLOCK",
]);

function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  return typeof code === "string" && TRANSIENT_ERROR_CODES.has(code);
}

// Corps d'écriture sans lock : ne doit être appelé que sous withFileLock
// (mutateJson) pour éviter un deadlock sur le lock par fichier.
async function writeJsonAtomicUnlocked<T>(filename: string, data: T, retries = 3): Promise<void> {
  await ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, filename);
  const tmpPath = filePath + ".tmp";

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
      await fs.rename(tmpPath, filePath);
      return;
    } catch (err) {
      lastError = err;
      if (!isTransientError(err) || attempt === retries - 1) {
        try {
          await fs.unlink(tmpPath);
        } catch {
          // Le fichier tmp n'existe pas forcément, on ignore.
        }
        throw err;
      }
      await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempt)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("writeJsonAtomic failed");
}

export async function writeJsonAtomic<T>(filename: string, data: T, retries = 3): Promise<void> {
  await withFileLock(filename, () => writeJsonAtomicUnlocked(filename, data, retries));
}

/**
 * Cycle complet read → mutate → write sous un seul lock par fichier.
 * Le mutator reçoit les données actuelles ; s'il retourne `null`, rien n'est
 * écrit (cas "aucun changement"). Sinon il peut muter `data` en place et
 * retourner void, ou retourner un nouvel objet à persister.
 * Retourne les données persistées, ou `null` si le mutator a retourné `null`.
 */
export async function mutateJson<T>(
  filename: string,
  fallback: T,
  mutator: (data: T) => T | null | void
): Promise<T | null> {
  return withFileLock(filename, async () => {
    const data = await readOrCreateUnlocked(filename, fallback);
    const result = mutator(data);
    if (result === null) return null;
    const next = result ?? data;
    // Backup périodique avant écriture : couvre TOUS les fichiers mutés
    // (y compris chat-history.json et activity.json, sans sauvegarde avant).
    await maybeBackup(filename);
    await writeJsonAtomicUnlocked(filename, next);
    return next;
  });
}

async function readJson<T>(filename: string): Promise<T> {
  await ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, filename);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function isValidJson(raw: string): boolean {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

async function readBackupJson<T>(filename: string): Promise<T | null> {
  try {
    await ensureDir(BACKUP_DIR);
  } catch {
    return null;
  }
  const prefix = `${filename}.`;
  let entries: string[];
  try {
    entries = await fs.readdir(BACKUP_DIR);
  } catch {
    return null;
  }
  const candidates = entries
    .filter((name) => name.startsWith(prefix) && name.endsWith(".bak"))
    .sort()
    .reverse();
  for (const name of candidates) {
    const backupPath = path.join(BACKUP_DIR, name);
    try {
      const raw = await fs.readFile(backupPath, "utf-8");
      if (isValidJson(raw)) {
        return JSON.parse(raw) as T;
      }
    } catch {
      // Continue avec le backup suivant.
    }
  }
  return null;
}

export async function readJsonSafe<T>(filename: string, fallback: T): Promise<T> {
  const filePath = path.join(DATA_DIR, filename);
  const tmpPath = filePath + ".tmp";

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    if (isValidJson(raw)) return JSON.parse(raw) as T;
  } catch {
    // Fichier principal absent ou illisible.
  }

  try {
    const raw = await fs.readFile(tmpPath, "utf-8");
    if (isValidJson(raw)) return JSON.parse(raw) as T;
  } catch {
    // Pas de fichier tmp.
  }

  const fromBackup = await readBackupJson<T>(filename);
  if (fromBackup !== null) return fromBackup;

  return fallback;
}

async function backupFile(filename: string): Promise<void> {
  await ensureDir(BACKUP_DIR);
  const src = path.join(DATA_DIR, filename);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dst = path.join(BACKUP_DIR, `${filename}.${ts}.bak`);
  try {
    await fs.copyFile(src, dst);
  } catch (err) {
    const code = (err as { code?: string }).code;
    // ENOENT = fichier pas encore créé, cas normal au premier write.
    if (code !== "ENOENT") {
      console.warn(`[storage] Backup échoué pour ${filename}:`, err);
    }
  }
}

async function rotateBackups(filename: string): Promise<void> {
  const prefix = `${filename}.`;
  let entries: string[];
  try {
    entries = await fs.readdir(BACKUP_DIR);
  } catch {
    return;
  }

  const backups = entries
    .filter((name) => name.startsWith(prefix) && name.endsWith(".bak"))
    .sort()
    .reverse();

  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  let kept = 0;

  for (const name of backups) {
    const backupPath = path.join(BACKUP_DIR, name);
    kept++;

    if (kept > 5) {
      try {
        await fs.unlink(backupPath);
      } catch {
        // Concurrent cleanup, ignore
      }
      continue;
    }

    const tsStr = name.slice(prefix.length, -".bak".length);
    try {
      const isoStr = tsStr.replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ":$1:$2.$3Z");
      const backupTime = new Date(isoStr).getTime();
      if (now - backupTime > SEVEN_DAYS_MS) {
        await fs.unlink(backupPath);
      }
    } catch {
      // Timestamp illisible, on garde le backup par sécurité
    }
  }
}

const BACKUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const lastBackup = new Map<string, number>();

export async function maybeBackup(filename: string): Promise<void> {
  const now = Date.now();
  const last = lastBackup.get(filename) ?? 0;
  if (now - last > BACKUP_INTERVAL_MS) {
    // On marque le backup comme fait SEULEMENT après succès, sinon on
    // retente à la prochaine écriture.
    try {
      await backupFile(filename);
      await rotateBackups(filename);
      lastBackup.set(filename, now);
    } catch (err) {
      console.warn(`[storage] Backup impossible pour ${filename}:`, err);
    }
  }
}

// Version sans lock : réservée à l'usage interne sous withFileLock (mutateJson).
async function readOrCreateUnlocked<T>(filename: string, fallback: T): Promise<T> {
  try {
    return await readJson<T>(filename);
  } catch {
    // Fichier absent OU corrompu : on tente la récupération depuis un backup
    // avant d'écraser avec le fallback (évite la perte définitive de données).
    const recovered = await readBackupJson<T>(filename);
    if (recovered !== null) {
      await writeJsonAtomicUnlocked(filename, recovered);
      return recovered;
    }
    // Clone du fallback : les mutateurs (mutateJson) peuvent le muter en place,
    // et il ne doit JAMAIS devenir un état partagé entre deux appels.
    const fresh = structuredClone(fallback);
    await writeJsonAtomicUnlocked(filename, fresh);
    return fresh;
  }
}

export async function readOrCreate<T>(filename: string, fallback: T): Promise<T> {
  try {
    return await readJson<T>(filename);
  } catch {
    const recovered = await readBackupJson<T>(filename);
    if (recovered !== null) {
      await writeJsonAtomic(filename, recovered);
      return recovered;
    }
    const fresh = structuredClone(fallback);
    await writeJsonAtomic(filename, fresh);
    return fresh;
  }
}
