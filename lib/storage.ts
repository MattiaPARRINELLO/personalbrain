import { promises as fs } from "fs";
import path from "path";
import type {
  ConcertsData,
  LeetcodeData,
  MemoryData,
  EmailsData,
  ConcertEvent,
  LeetcodeExercise,
  MemoryFact,
  MemoryRelationship,
  CalendarEvent,
  Email,
  Reminder,
  RemindersData,
  WatchLaterItem,
  WatchLaterData,
  WatchLaterCategory,
  Accreditation,
  AccreditationsData,
  PhotoShoot,
  PhotoShootsData,
  ActivityEntry,
  ActivityData,
  ActivityAction,
  ChatHistory,
  ChatSession,
  ConcertPrep,
  GalleryItem,
  GalleryData,
  GalleryStatus,
  DailyBrief,
} from "./types";

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

async function writeJsonAtomic<T>(filename: string, data: T, retries = 3): Promise<void> {
  await ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, filename);
  const tmpPath = filePath + ".tmp";

  await withFileLock(filename, async () => {
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
  });
}

export { writeJsonAtomic };

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
  } catch {
    // Fichier source n'existe pas encore
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

async function maybeBackup(filename: string): Promise<void> {
  const now = Date.now();
  const last = lastBackup.get(filename) ?? 0;
  if (now - last > BACKUP_INTERVAL_MS) {
    lastBackup.set(filename, now);
    await backupFile(filename);
    await rotateBackups(filename);
  }
}

const defaultConcerts: ConcertsData = {
  events: [
    { id: "1", artist: "Muse", venue: "Accor Arena", date: "2026-07-15", status: "shooted" },
    { id: "2", artist: "Daft Punk", venue: "Stade de France", date: "2026-08-02", status: "shooted" },
    { id: "3", artist: "Phoenix", venue: "Zenith Paris", date: "2026-06-20", status: "selecting" },
    { id: "4", artist: "Justice", venue: "Olympia", date: "2026-05-10", status: "selecting" },
    { id: "5", artist: "Air", venue: "Philharmonie", date: "2026-04-18", status: "editing" },
    { id: "6", artist: "Gojira", venue: "Hellfest", date: "2026-06-29", status: "editing" },
    { id: "7", artist: "Christine & The Queens", venue: "Bercy", date: "2026-03-05", status: "delivered" },
    { id: "8", artist: "L'Imperatrice", venue: "Cigale", date: "2026-02-14", status: "delivered" },
  ],
};

const defaultLeetcode: LeetcodeData = {
  streak: 0,
  history: [],
  exercises: [],
};

const defaultMemory: MemoryData = {
  relationships: [],
  profile: {
    name: "Mattia",
    preferences: ["TypeScript", "React", "Next.js", "photographie de concert"],
  },
  facts: [
    { id: "1", content: "Prefere coder en TypeScript", category: "dev", createdAt: new Date().toISOString() },
    { id: "2", content: "Prochain concert : Muse le 15 juillet 2026 a l'Accor Arena", category: "photo", createdAt: new Date().toISOString() },
  ],
};

const defaultEmails: EmailsData = {
  emails: [
    {
      id: "1",
      from: "Faustine",
      subject: "Shooting samedi",
      body: "Salut ! Est-ce que tu es dispo samedi apres-midi pour un shooting portrait ? On partirait vers 15h au jardin.",
      date: new Date(Date.now() - 86400000).toISOString(),
      unread: true,
    },
    {
      id: "2",
      from: "Billetterie",
      subject: "Tes billets pour Justice",
      body: "Ta commande pour Justice a l'Olympia est confirmee. Places numerotees, rang A.",
      date: new Date(Date.now() - 172800000).toISOString(),
      unread: false,
    },
  ],
};

const defaultReminders: RemindersData = { reminders: [] };
const defaultWatchLater: WatchLaterData = { items: [] };

async function readOrCreate<T>(filename: string, fallback: T): Promise<T> {
  try {
    return await readJson<T>(filename);
  } catch {
    await writeJsonAtomic(filename, fallback);
    return fallback;
  }
}

export async function getConcerts(): Promise<ConcertsData> {
  return readOrCreate("concerts.json", defaultConcerts);
}

export async function saveConcerts(data: ConcertsData): Promise<void> {
  await maybeBackup("concerts.json");
  return writeJsonAtomic("concerts.json", data);
}

export async function updateConcertEvents(events: ConcertEvent[]): Promise<void> {
  await saveConcerts({ events });
}

export async function prepareConcert(concertId: string): Promise<ConcertPrep> {
  const data = await getConcerts();
  const concert = data.events.find((c) => c.id === concertId);
  if (!concert) throw new Error(`Concert ${concertId} introuvable`);

  const weather = await (async () => {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) return "Météo non disponible";
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(concert.venue)}&appid=${apiKey}&units=metric&lang=fr`
      );
      if (!res.ok) return "Météo non disponible";
      const data = await res.json() as { list: { dt_txt: string; main: { temp: number; feels_like: number }; weather: { description: string }[] }[] };
      const concertDate = concert.date.slice(0, 10);
      const dayForecast = data.list.find((f: { dt_txt: string }) => f.dt_txt.startsWith(concertDate));
      if (!dayForecast) return "Météo non disponible pour cette date";
      return `${dayForecast.main.temp}°C (ressenti ${dayForecast.main.feels_like}°C), ${dayForecast.weather[0].description}`;
    } catch {
      return "Météo non disponible";
    }
  })();

  const venueInfo = await webSearch(
    `caractéristiques salle de concert ${concert.venue} capacité fosse photo`
  );

  const checklist = [
    `📷 Boîtier principal (vérifier batterie + carte mémoire)`,
    `📷 Boîtier secondaire (si applicable)`,
    `🔭 Objectif 24-70mm f/2.8 (standard concert)`,
    `🔭 Objectif 70-200mm f/2.8 (zoom)`,
    `🔭 Objectif grand-angle 16-35mm (si fosse)`,
    `⚡ Batteries supplémentaires (×2 minimum)`,
    `💾 Cartes mémoire formatées (×3 minimum)`,
    `🎒 Sac photo adapté (vérifier poids)`,
    `🎟️ Accréditation / Pass imprimé`,
    `🆔 Pièce d'identité`,
    `💧 Bouteille d'eau`,
    `🔦 Lampe torche (si salle sombre)`,
  ];

  return {
    weather,
    venueInfo,
    checklist,
    travelTips: [
      `Arriver 1h30 avant l'ouverture des portes`,
      `Vérifier les restrictions (sac, flash, monopode)`,
      `Repérer la fosse photo et les zones autorisées`,
      `Prévoir des bouchons d'oreilles`,
    ],
  };
}

export async function getWeather(city: string): Promise<string> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) return "Erreur : clé API météo non configurée.";
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`
    );
    if (!res.ok) {
      if (res.status === 404) return `Ville "${city}" introuvable.`;
      return `Erreur API météo (${res.status}).`;
    }
    const data = await res.json() as {
      main: { temp: number; feels_like: number; humidity: number };
      weather: { description: string }[];
      wind: { speed: number };
      name: string;
    };
    return [
      `**${data.name}** : ${data.main.temp}°C (ressenti ${data.main.feels_like}°C)`,
      `${data.weather[0].description}`,
      `Humidité : ${data.main.humidity}%`,
      `Vent : ${data.wind.speed} m/s`,
    ].join(" — ");
  } catch (err) {
    return `Erreur : ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function getGallery(): Promise<GalleryData> {
  return readOrCreate("gallery.json", { items: [] });
}

export async function saveGallery(data: GalleryData): Promise<void> {
  await maybeBackup("gallery.json");
  return writeJsonAtomic("gallery.json", data);
}

export async function addGalleryItem(input: {
  concertId: string;
  title: string;
  totalPhotos: number;
  deadline?: string;
}): Promise<GalleryItem> {
  const data = await getGallery();
  const item: GalleryItem = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    concertId: input.concertId,
    title: input.title,
    totalPhotos: input.totalPhotos,
    selectedPhotos: 0,
    editedPhotos: 0,
    status: "shooted",
    deadline: input.deadline,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.items.unshift(item);
  await saveGallery(data);
  return item;
}

export async function updateGalleryItem(id: string, updates: Partial<Pick<GalleryItem, "status" | "selectedPhotos" | "editedPhotos" | "deliveredTo" | "totalPhotos">>): Promise<GalleryItem | null> {
  const data = await getGallery();
  const idx = data.items.findIndex((g) => g.id === id);
  if (idx < 0) return null;
  data.items[idx] = { ...data.items[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveGallery(data);
  return data.items[idx];
}

export async function deleteGalleryItem(id: string): Promise<boolean> {
  const data = await getGallery();
  const before = data.items.length;
  data.items = data.items.filter((g) => g.id !== id);
  if (data.items.length === before) return false;
  await saveGallery(data);
  return true;
}

export async function getLeetcode(): Promise<LeetcodeData> {
  return readOrCreate("leetcode.json", defaultLeetcode);
}

export async function saveLeetcode(data: LeetcodeData): Promise<void> {
  await maybeBackup("leetcode.json");
  return writeJsonAtomic("leetcode.json", data);
}

export async function addLeetcodeExercise(exercise: LeetcodeExercise): Promise<void> {
  const data = await getLeetcode();
  data.exercises.unshift(exercise);
  data.history.push({ date: new Date().toISOString(), solved: true });
  await saveLeetcode(data);
}

export async function getMemory(): Promise<MemoryData> {
  return readOrCreate("memory.json", defaultMemory);
}

export async function saveMemory(data: MemoryData): Promise<void> {
  await maybeBackup("memory.json");
  return writeJsonAtomic("memory.json", data);
}

export async function addMemoryFact(
  content: string,
  category: MemoryFact["category"],
  options?: { source?: MemoryFact["source"]; confidence?: number }
): Promise<MemoryFact> {
  const data = await getMemory();
  const fact: MemoryFact = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    content,
    category,
    createdAt: new Date().toISOString(),
    source: options?.source ?? "manual",
    confidence: options?.confidence,
    accessCount: 0,
  };
  data.facts.push(fact);
  await saveMemory(data);
  return fact;
}

export async function updateMemoryFact(id: string, updates: Partial<Pick<MemoryFact, "content" | "category">>): Promise<MemoryFact | null> {
  const data = await getMemory();
  const idx = data.facts.findIndex((f) => f.id === id);
  if (idx < 0) return null;
  data.facts[idx] = { ...data.facts[idx], ...updates };
  await saveMemory(data);
  return data.facts[idx];
}

export async function touchMemoryFact(id: string): Promise<void> {
  const data = await getMemory();
  const idx = data.facts.findIndex((f) => f.id === id);
  if (idx < 0) return;
  data.facts[idx] = {
    ...data.facts[idx],
    accessCount: (data.facts[idx].accessCount ?? 0) + 1,
    lastAccessedAt: new Date().toISOString(),
  };
  await saveMemory(data);
}

export async function findSimilarMemoryFacts(content: string, category: MemoryFact["category"]): Promise<MemoryFact | null> {
  const data = await getMemory();
  const norm = (s: string) => s.toLowerCase().trim();
  const target = norm(content);
  return (
    data.facts.find(
      (f) => f.category === category && norm(f.content) === target
    ) ?? null
  );
}

export async function deleteMemoryFact(id: string): Promise<boolean> {
  const data = await getMemory();
  const before = data.facts.length;
  data.facts = data.facts.filter((f) => f.id !== id);
  if (data.facts.length === before) return false;
  await saveMemory(data);
  return true;
}

export async function getMemoryRelationships(): Promise<MemoryRelationship[]> {
  const data = await getMemory();
  return data.relationships ?? [];
}

export async function addMemoryRelationship(
  sourceId: string,
  targetId: string,
  type: string
): Promise<MemoryRelationship> {
  const data = await getMemory();
  const rel: MemoryRelationship = {
    sourceId,
    targetId,
    type,
    createdAt: new Date().toISOString(),
  };
  const exists = data.relationships.some(
    (r) => r.sourceId === sourceId && r.targetId === targetId && r.type === type
  );
  if (exists) return rel;
  data.relationships.push(rel);
  await saveMemory(data);
  return rel;
}

export async function getRelatedFacts(factId: string): Promise<{ fact: MemoryFact; relationship: MemoryRelationship }[]> {
  const data = await getMemory();
  const rels = data.relationships.filter(
    (r) => r.sourceId === factId || r.targetId === factId
  );
  const result: { fact: MemoryFact; relationship: MemoryRelationship }[] = [];
  for (const rel of rels) {
    const otherId = rel.sourceId === factId ? rel.targetId : rel.sourceId;
    const fact = data.facts.find((f) => f.id === otherId);
    if (fact) result.push({ fact, relationship: rel });
  }
  return result;
}

export async function getEmails(): Promise<EmailsData> {
  return readOrCreate("emails.json", defaultEmails);
}

export async function saveEmails(data: EmailsData): Promise<void> {
  await maybeBackup("emails.json");
  return writeJsonAtomic("emails.json", data);
}

export async function markEmailRead(id: string): Promise<void> {
  const data = await getEmails();
  const email = data.emails.find((e) => e.id === id);
  if (email) {
    email.unread = false;
    await saveEmails(data);
  }
}

export async function getCalendar(): Promise<CalendarEvent[]> {
  const concerts = await getConcerts();
  return concerts.events.map((evt) => ({
    id: evt.id,
    title: `Concert : ${evt.artist}`,
    date: evt.date,
    venue: evt.venue,
    type: "concert" as const,
  }));
}

export async function addCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
  const concerts = await getConcerts();
  const newEvent: CalendarEvent = {
    ...event,
    id: crypto.randomUUID?.() ?? String(Date.now()),
  };

  if (event.type === "concert") {
    concerts.events.push({
      id: newEvent.id,
      artist: event.title.replace(/^Concert :\s*/i, ""),
      venue: event.venue ?? "",
      date: event.date,
      status: "shooted",
    });
    await saveConcerts(concerts);
  } else {
    const existing = await readOrCreate("calendar.json", { events: [] as CalendarEvent[] });
    existing.events.push(newEvent);
    await maybeBackup("calendar.json");
    await writeJsonAtomic("calendar.json", existing);
  }

  return newEvent;
}

export async function searchEmails(query: string): Promise<Email[]> {
  const data = await getEmails();
  const q = query.toLowerCase();
  return data.emails.filter(
    (e) =>
      e.from.toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q)
  );
}

export async function webSearch(query: string): Promise<string> {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
        {
          signal: controller.signal,
          headers: {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": braveKey,
          },
        }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const results = data.web?.results ?? [];
        if (results.length > 0) {
          return results.slice(0, 3).map((r: { title: string; url: string; description: string }) =>
            `- ${r.title}\n  ${r.description}\n  ${r.url}`
          ).join("\n\n");
        }
        return `Aucun résultat web pour "${query}".`;
      }
    } catch {
      clearTimeout(timeout);
      // Fallback à DuckDuckGo
    }
  }

  // Fallback : recherche DuckDuckGo (gratuite, sans clé)
  const fallbackController = new AbortController();
  const fallbackTimeout = setTimeout(() => fallbackController.abort(), 10_000);
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
      { signal: fallbackController.signal }
    );
    clearTimeout(fallbackTimeout);
    if (res.ok) {
      const data = await res.json();
      const abstract = data.AbstractText;
      const results = data.RelatedTopics ?? [];
      if (abstract) {
        return abstract;
      }
      if (results.length > 0) {
        const texts = results.slice(0, 3).map((r: { Text?: string; Result?: string }) =>
          r.Text ?? r.Result ?? ""
        ).filter(Boolean);
        if (texts.length > 0) return texts.join("\n\n");
      }
    }
  } catch {
    clearTimeout(fallbackTimeout);
  }

  return `Recherche web pour "${query}" : aucun résultat trouvé.`;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function fetchPageMeta(url: string): Promise<{ title: string; thumbnail?: string }> {
  try {
    const ytId = extractYouTubeId(url);
    if (ytId) {
      return {
        title: "",
        thumbnail: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
      };
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BACKSTAGE/1.0)" },
    });
    if (!res.ok) return { title: `Impossible de récupérer la page (${res.status})` };
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);

    return {
      title: ogTitle?.[1]?.trim() ?? titleMatch?.[1]?.trim() ?? "Titre non trouvé",
      thumbnail: ogImage?.[1] || undefined,
      description: ogDesc?.[1]?.trim(),
    } as { title: string; thumbnail?: string; description?: string };
  } catch {
    return { title: "Erreur de récupération du titre" };
  }
}

export async function getReminders(): Promise<RemindersData> {
  return readOrCreate("reminders.json", defaultReminders);
}

export async function saveReminders(data: RemindersData): Promise<void> {
  await maybeBackup("reminders.json");
  return writeJsonAtomic("reminders.json", data);
}

export async function addReminder(input: {
  title: string;
  notes?: string;
  dueAt: string;
  recurrence?: Reminder["recurrence"];
}): Promise<Reminder> {
  const data = await getReminders();
  const reminder: Reminder = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    title: input.title.trim(),
    notes: input.notes?.trim() || undefined,
    dueAt: input.dueAt,
    status: "pending",
    createdAt: new Date().toISOString(),
    recurrence: input.recurrence,
  };
  data.reminders.unshift(reminder);
  await saveReminders(data);
  return reminder;
}

export async function updateReminder(id: string, updates: Partial<Pick<Reminder, "title" | "notes" | "dueAt" | "status" | "notifiedAt" | "recurrence">>): Promise<Reminder | null> {
  const data = await getReminders();
  const idx = data.reminders.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  data.reminders[idx] = { ...data.reminders[idx], ...updates };
  await saveReminders(data);
  return data.reminders[idx];
}

export function computeNextRecurrence(dueAt: string, recurrence: Reminder["recurrence"]): string | null {
  if (!recurrence) return null;
  const d = new Date(dueAt);
  if (isNaN(d.getTime())) return null;
  switch (recurrence) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d.toISOString();
}

export async function deleteReminder(id: string): Promise<boolean> {
  const data = await getReminders();
  const before = data.reminders.length;
  data.reminders = data.reminders.filter((r) => r.id !== id);
  if (data.reminders.length === before) return false;
  await saveReminders(data);
  return true;
}

export async function getWatchLater(): Promise<WatchLaterData> {
  return readOrCreate("watch-later.json", defaultWatchLater);
}

export async function saveWatchLater(data: WatchLaterData): Promise<void> {
  await maybeBackup("watch-later.json");
  return writeJsonAtomic("watch-later.json", data);
}

export async function addWatchLaterItem(input: {
  url: string;
  title: string;
  description?: string;
  thumbnail?: string;
  source?: string;
  category?: WatchLaterCategory;
}): Promise<WatchLaterItem> {
  const data = await getWatchLater();
  const item: WatchLaterItem = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    url: input.url,
    title: input.title,
    description: input.description,
    thumbnail: input.thumbnail,
    source: input.source || detectSource(input.url),
    category: input.category || detectCategory(input.url),
    createdAt: new Date().toISOString(),
  };
  data.items.unshift(item);
  await saveWatchLater(data);
  return item;
}

export async function updateWatchLaterItem(id: string, updates: Partial<Pick<WatchLaterItem, "title" | "description" | "category" | "summary" | "aiTags" | "read">>): Promise<WatchLaterItem | null> {
  const data = await getWatchLater();
  const idx = data.items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  data.items[idx] = { ...data.items[idx], ...updates };
  await saveWatchLater(data);
  return data.items[idx];
}

export async function deleteWatchLaterItem(id: string): Promise<boolean> {
  const data = await getWatchLater();
  const before = data.items.length;
  data.items = data.items.filter((i) => i.id !== id);
  if (data.items.length === before) return false;
  await saveWatchLater(data);
  return true;
}

export async function reorderWatchLaterItems(orderedIds: string[]): Promise<boolean> {
  const data = await getWatchLater();
  const byId = new Map(data.items.map((i) => [i.id, i] as const));
  const next: typeof data.items = [];
  for (const id of orderedIds) {
    const found = byId.get(id);
    if (found) next.push(found);
  }
  for (const i of data.items) {
    if (!orderedIds.includes(i.id)) next.push(i);
  }
  data.items = next;
  await saveWatchLater(data);
  return true;
}

function detectSource(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "lien";
  }
}

function detectCategory(url: string): WatchLaterCategory {
  const lower = url.toLowerCase();
  if (/(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv)/.test(lower)) return "video";
  if (/spotify\.|soundcloud\.|bandcamp\./.test(lower)) return "music";
  if (/\.(jpg|jpeg|png|gif|webp|avif|unsplash|pexels|imgur)/.test(lower)) return "photo";
  if (/(medium\.|dev\.to|github\.com\/.*\/blob|arxiv\.|wikipedia|blog)/.test(lower)) return "article";
  return "other";
}

export async function markWatchLaterRead(id: string): Promise<void> {
  const data = await getWatchLater();
  const idx = data.items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    data.items[idx] = { ...data.items[idx], read: true };
    await saveWatchLater(data);
  }
}

export async function autoSummarize(url: string, title: string): Promise<{ summary: string; tags: string[] }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BACKSTAGE/1.0)" },
    });
    if (!res.ok) return { summary: "", tags: [] };
    const html = await res.text();

    // Extraction de texte minimal : enlever scripts, styles, balises
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    if (!text) return { summary: "", tags: [] };

    const { chatCompletion } = await import("@/lib/ai-providers");
    const { getConfig } = await import("@/lib/config");
    const config = await getConfig();
    const model = config.models.general;

    const result = await chatCompletion(
      model,
      [
        {
          role: "system",
          content:
            'Tu analyses du contenu web en français. Réponds UNIQUEMENT au format JSON : {"summary": "résumé en 1-2 phrases", "tags": ["tag1","tag2","tag3"]}',
        },
        { role: "user", content: `Titre: ${title}\n\nContenu:\n${text}` },
      ],
      []
    );

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { summary?: string; tags?: string[] };
      return {
        summary: parsed.summary?.trim() ?? "",
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      };
    }

    return { summary: result.content.slice(0, 200).trim(), tags: [] };
  } catch {
    return { summary: "", tags: [] };
  }
}

/* ───── Activity Log ───── */

const MAX_ACTIVITY_ENTRIES = 200;
const defaultActivity: ActivityData = { entries: [] };

export async function getActivity(limit = 50): Promise<ActivityEntry[]> {
  const data = await readOrCreate("activity.json", defaultActivity);
  return data.entries.slice(0, limit);
}

export async function logActivity(action: ActivityAction, label: string, details?: string): Promise<void> {
  const data = await readOrCreate("activity.json", defaultActivity);
  const entry: ActivityEntry = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    action,
    label,
    details,
    createdAt: new Date().toISOString(),
  };
  data.entries.unshift(entry);
  if (data.entries.length > MAX_ACTIVITY_ENTRIES) {
    data.entries = data.entries.slice(0, MAX_ACTIVITY_ENTRIES);
  }
  await writeJsonAtomic("activity.json", data);
}

/* ───── Accreditations ───── */

const defaultAccreditations: AccreditationsData = { accreditations: [] };

export async function getAccreditations(): Promise<AccreditationsData> {
  return readOrCreate("accreditations.json", defaultAccreditations);
}

export async function saveAccreditations(data: AccreditationsData): Promise<void> {
  await maybeBackup("accreditations.json");
  return writeJsonAtomic("accreditations.json", data);
}

export async function addAccreditation(input: {
  artist: string;
  venue: string;
  concertDate: string;
  contactEmail?: string;
  notes?: string;
}): Promise<Accreditation> {
  const data = await getAccreditations();
  const now = new Date().toISOString();
  const accreditation: Accreditation = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    artist: input.artist,
    venue: input.venue,
    concertDate: input.concertDate,
    status: "pending",
    contactEmail: input.contactEmail,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  data.accreditations.unshift(accreditation);
  await saveAccreditations(data);
  return accreditation;
}

export async function updateAccreditation(
  id: string,
  updates: Partial<Pick<Accreditation, "status" | "notes" | "contactEmail">>
): Promise<Accreditation | null> {
  const data = await getAccreditations();
  const idx = data.accreditations.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  data.accreditations[idx] = { ...data.accreditations[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveAccreditations(data);
  return data.accreditations[idx];
}

export async function deleteAccreditation(id: string): Promise<boolean> {
  const data = await getAccreditations();
  const before = data.accreditations.length;
  data.accreditations = data.accreditations.filter((a) => a.id !== id);
  if (data.accreditations.length === before) return false;
  await saveAccreditations(data);
  return true;
}

export async function searchAccreditations(query: string): Promise<Accreditation[]> {
  const data = await getAccreditations();
  const q = query.toLowerCase();
  return data.accreditations.filter(
    (a) =>
      a.artist.toLowerCase().includes(q) ||
      a.venue.toLowerCase().includes(q) ||
      (a.notes && a.notes.toLowerCase().includes(q))
  );
}

const defaultChatHistory: ChatHistory = {
  sessions: [],
};

export async function getChatHistory(): Promise<ChatHistory> {
  return readJsonSafe<ChatHistory>("chat-history.json", defaultChatHistory);
}

export async function saveChatHistory(data: ChatHistory): Promise<void> {
  await writeJsonAtomic("chat-history.json", data);
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  const data = await getChatHistory();
  const idx = data.sessions.findIndex((s) => s.id === session.id);
  session.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    data.sessions[idx] = session;
  } else {
    data.sessions.push(session);
  }
  await saveChatHistory(data);
}

export async function deleteChatSession(id: string): Promise<boolean> {
  const data = await getChatHistory();
  const before = data.sessions.length;
  data.sessions = data.sessions.filter((s) => s.id !== id);
  if (data.sessions.length === before) return false;
  await saveChatHistory(data);
  return true;
}

/* ───── Photo Shoots ───── */

const defaultPhotoShoots: PhotoShootsData = { shoots: [] };

export async function getPhotoShoots(): Promise<PhotoShootsData> {
  return readOrCreate("photo-shoots.json", defaultPhotoShoots);
}

export async function savePhotoShoots(data: PhotoShootsData): Promise<void> {
  await maybeBackup("photo-shoots.json");
  return writeJsonAtomic("photo-shoots.json", data);
}

export async function addPhotoShoot(input: {
  title: string;
  date: string;
  client: string;
  notes?: string;
}): Promise<PhotoShoot> {
  const data = await getPhotoShoots();
  const now = new Date().toISOString();
  const shoot: PhotoShoot = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    title: input.title,
    date: input.date,
    client: input.client,
    status: "upcoming",
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  data.shoots.unshift(shoot);
  await savePhotoShoots(data);
  return shoot;
}

export async function updatePhotoShoot(
  id: string,
  updates: Partial<Pick<PhotoShoot, "status" | "notes" | "galleryLink" | "photosSent" | "title" | "date" | "client">>
): Promise<PhotoShoot | null> {
  const data = await getPhotoShoots();
  const idx = data.shoots.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  data.shoots[idx] = { ...data.shoots[idx], ...updates, updatedAt: new Date().toISOString() };
  await savePhotoShoots(data);
  return data.shoots[idx];
}

export async function deletePhotoShoot(id: string): Promise<boolean> {
  const data = await getPhotoShoots();
  const before = data.shoots.length;
  data.shoots = data.shoots.filter((s) => s.id !== id);
  if (data.shoots.length === before) return false;
  await savePhotoShoots(data);
  return true;
}
