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
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

async function ensureDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

async function readJson<T>(filename: string, fallback: T): Promise<T> {
  await ensureDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filename: string, data: T): Promise<void> {
  await ensureDir();
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
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

export async function getConcerts(): Promise<ConcertsData> {
  return readJson<ConcertsData>("concerts.json", defaultConcerts);
}

export async function saveConcerts(data: ConcertsData): Promise<void> {
  return writeJson("concerts.json", data);
}

export async function updateConcertEvents(events: ConcertEvent[]): Promise<void> {
  await saveConcerts({ events });
}

export async function getLeetcode(): Promise<LeetcodeData> {
  return readJson<LeetcodeData>("leetcode.json", defaultLeetcode);
}

export async function saveLeetcode(data: LeetcodeData): Promise<void> {
  return writeJson("leetcode.json", data);
}

export async function addLeetcodeExercise(exercise: LeetcodeExercise): Promise<void> {
  const data = await getLeetcode();
  data.exercises.unshift(exercise);
  data.history.push({ date: new Date().toISOString(), solved: true });
  await saveLeetcode(data);
}

export async function getMemory(): Promise<MemoryData> {
  return readJson<MemoryData>("memory.json", defaultMemory);
}

export async function saveMemory(data: MemoryData): Promise<void> {
  return writeJson("memory.json", data);
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
  return readJson<EmailsData>("emails.json", defaultEmails);
}

export async function saveEmails(data: EmailsData): Promise<void> {
  return writeJson("emails.json", data);
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
    const existing = await readJson<{ events: CalendarEvent[] }>("calendar.json", { events: [] });
    existing.events.push(newEvent);
    await writeJson("calendar.json", existing);
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
  const facts: Record<string, string> = {
    muse: "Muse est un groupe britannique forme en 1994. Leur prochaine tournee europeenne est attendue pour 2026.",
    react: "React 19 est sorti avec de nouveaux hooks comme use() et des ameliorations de Server Components.",
    typescript: "TypeScript 5.7 apporte des ameliorations de performance et de nouvelles regles de lint.",
    concert: "Pour photographier un concert en interieur : ouverture f/2.8, ISO 3200-6400, vitesse 1/250s minimum.",
  };
  const key = Object.keys(facts).find((k) => query.toLowerCase().includes(k));
  if (key) return facts[key];
  return `Resultats de recherche pour "${query}" : aucune information predefinie. Essaie avec un mot-cle comme Muse, React, TypeScript ou concert.`;
}

export async function getReminders(): Promise<RemindersData> {
  return readJson<RemindersData>("reminders.json", defaultReminders);
}

export async function saveReminders(data: RemindersData): Promise<void> {
  return writeJson("reminders.json", data);
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
  return readJson<WatchLaterData>("watch-later.json", defaultWatchLater);
}

export async function saveWatchLater(data: WatchLaterData): Promise<void> {
  return writeJson("watch-later.json", data);
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

export async function updateWatchLaterItem(id: string, updates: Partial<Pick<WatchLaterItem, "title" | "description" | "category">>): Promise<WatchLaterItem | null> {
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
