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
  CalendarEvent,
  Email,
  Reminder,
  RemindersData,
  WatchLaterItem,
  WatchLaterData,
  WatchLaterCategory,
  Accreditation,
  AccreditationsData,
  ActivityEntry,
  ActivityData,
  ActivityAction,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJsonAtomic<T>(filename: string, data: T): Promise<void> {
  await ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, filename);
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

async function readJson<T>(filename: string): Promise<T> {
  await ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, filename);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
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

const BACKUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const lastBackup = new Map<string, number>();

async function maybeBackup(filename: string): Promise<void> {
  const now = Date.now();
  const last = lastBackup.get(filename) ?? 0;
  if (now - last > BACKUP_INTERVAL_MS) {
    lastBackup.set(filename, now);
    await backupFile(filename);
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
      subject: "Vos billets pour Justice",
      body: "Votre commande pour Justice a l'Olympia est confirmee. Places numerotees, rang A.",
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

export async function addMemoryFact(content: string, category: MemoryFact["category"]): Promise<MemoryFact> {
  const data = await getMemory();
  const fact: MemoryFact = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    content,
    category,
    createdAt: new Date().toISOString(),
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

export async function deleteMemoryFact(id: string): Promise<boolean> {
  const data = await getMemory();
  const before = data.facts.length;
  data.facts = data.facts.filter((f) => f.id !== id);
  if (data.facts.length === before) return false;
  await saveMemory(data);
  return true;
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
  const apiKey = process.env.SEARCHAPI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(query)}&api_key=${apiKey}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        const results = data.organic_results ?? [];
        if (results.length > 0) {
          return results.slice(0, 3).map((r: { title: string; link: string; snippet: string }) =>
            `- ${r.title}\n  ${r.snippet}\n  ${r.link}`
          ).join("\n\n");
        }
        return `Aucun résultat web pour "${query}".`;
      }
    } catch {
      // Fallback à DuckDuckGo
    }
  }

  // Fallback : recherche DuckDuckGo (gratuite, sans clé)
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
      { signal: AbortSignal.timeout(5000) }
    );
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
    // Silence
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
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PersonalBrain/1.0)" },
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
}): Promise<Reminder> {
  const data = await getReminders();
  const reminder: Reminder = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    title: input.title.trim(),
    notes: input.notes?.trim() || undefined,
    dueAt: input.dueAt,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  data.reminders.unshift(reminder);
  await saveReminders(data);
  return reminder;
}

export async function updateReminder(id: string, updates: Partial<Pick<Reminder, "title" | "notes" | "dueAt" | "status" | "notifiedAt">>): Promise<Reminder | null> {
  const data = await getReminders();
  const idx = data.reminders.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  data.reminders[idx] = { ...data.reminders[idx], ...updates };
  await saveReminders(data);
  return data.reminders[idx];
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
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PersonalBrain/1.0)" },
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
