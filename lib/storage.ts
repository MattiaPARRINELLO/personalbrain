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
  PhotoShootStatus,
  PhotoShootsData,
  ActivityEntry,
  ActivityData,
  ActivityAction,
  ChatHistory,
  ChatSession,
  ConcertPrep,
  GalleryItem,
  GalleryData,
  Intention,
  IntentionsData,
} from "./types";
import { maybeBackup, mutateJson, readJsonSafe, readOrCreate, writeJsonAtomic } from "./storage-core";

export { readJsonSafe, writeJsonAtomic };

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
  await mutateJson<GalleryData>("gallery.json", { items: [] }, (data) => {
    data.items.unshift(item);
  });
  return item;
}

export async function updateGalleryItem(id: string, updates: Partial<Pick<GalleryItem, "status" | "selectedPhotos" | "editedPhotos" | "deliveredTo" | "totalPhotos">>): Promise<GalleryItem | null> {
  let updated: GalleryItem | null = null;
  await mutateJson<GalleryData>("gallery.json", { items: [] }, (data) => {
    const idx = data.items.findIndex((g) => g.id === id);
    if (idx < 0) return null;
    data.items[idx] = { ...data.items[idx], ...updates, updatedAt: new Date().toISOString() };
    updated = data.items[idx];
  });
  return updated;
}

export async function deleteGalleryItem(id: string): Promise<boolean> {
  let deleted = false;
  await mutateJson<GalleryData>("gallery.json", { items: [] }, (data) => {
    const before = data.items.length;
    data.items = data.items.filter((g) => g.id !== id);
    deleted = data.items.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
}

export async function getLeetcode(): Promise<LeetcodeData> {
  return readOrCreate("leetcode.json", defaultLeetcode);
}

export async function saveLeetcode(data: LeetcodeData): Promise<void> {
  await maybeBackup("leetcode.json");
  return writeJsonAtomic("leetcode.json", data);
}

export async function addLeetcodeExercise(exercise: LeetcodeExercise): Promise<void> {
  await mutateJson<LeetcodeData>("leetcode.json", defaultLeetcode, (data) => {
    data.exercises.unshift(exercise);
    data.history.push({ date: new Date().toISOString(), solved: true });
  });
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
  const fact: MemoryFact = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    content,
    category,
    createdAt: new Date().toISOString(),
    source: options?.source ?? "manual",
    confidence: options?.confidence,
    accessCount: 0,
  };
  await mutateJson<MemoryData>("memory.json", defaultMemory, (data) => {
    data.facts.push(fact);
  });
  return fact;
}

export async function updateMemoryFact(id: string, updates: Partial<Pick<MemoryFact, "content" | "category">>): Promise<MemoryFact | null> {
  let updated: MemoryFact | null = null;
  await mutateJson<MemoryData>("memory.json", defaultMemory, (data) => {
    const idx = data.facts.findIndex((f) => f.id === id);
    if (idx < 0) return null;
    data.facts[idx] = { ...data.facts[idx], ...updates };
    updated = data.facts[idx];
  });
  return updated;
}

export async function touchMemoryFact(id: string): Promise<void> {
  await mutateJson<MemoryData>("memory.json", defaultMemory, (data) => {
    const idx = data.facts.findIndex((f) => f.id === id);
    if (idx < 0) return null;
    data.facts[idx] = {
      ...data.facts[idx],
      accessCount: (data.facts[idx].accessCount ?? 0) + 1,
      lastAccessedAt: new Date().toISOString(),
    };
  });
}

export async function findSimilarMemoryFacts(content: string, category: MemoryFact["category"]): Promise<MemoryFact | null> {
  const data = await getMemory();
  const categoryFacts = data.facts.filter((f) => f.category === category);
  if (categoryFacts.length === 0) return null;

  // Try AI semantic matching
  try {
    const { chatCompletion } = await import("./ai-providers");
    const { getConfig } = await import("./config");
    const config = await getConfig();
    const model = config.models.generalAlt;

    const factsList = categoryFacts
      .map((f) => `- id=${f.id}: ${f.content}`)
      .join("\n");
    const result = await chatCompletion(
      model,
      [
        {
          role: "system",
          content:
            "Tu compares un nouveau texte avec une liste de faits existants. Retourne UNIQUEMENT l'id du fait le plus similaire sémantiquement, ou 'null' si aucun ne correspond. Ne retourne rien d'autre.",
        },
        {
          role: "user",
          content: `Nouveau texte: "${content}"\nFaits existants:\n${factsList}`,
        },
      ],
      []
    );

    const id = result.content.trim();
    if (id && id !== "null") {
      const found = categoryFacts.find((f) => f.id === id);
      if (found) return found;
    }
  } catch {
    // Fall back to exact match below
  }

  // Fallback: exact match (normalisé)
  const norm = (s: string) => s.toLowerCase().trim();
  const target = norm(content);
  return categoryFacts.find((f) => norm(f.content) === target) ?? null;
}

export async function deleteMemoryFact(id: string): Promise<boolean> {
  let deleted = false;
  await mutateJson<MemoryData>("memory.json", defaultMemory, (data) => {
    const before = data.facts.length;
    data.facts = data.facts.filter((f) => f.id !== id);
    deleted = data.facts.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
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
  const rel: MemoryRelationship = {
    sourceId,
    targetId,
    type,
    createdAt: new Date().toISOString(),
  };
  await mutateJson<MemoryData>("memory.json", defaultMemory, (data) => {
    const exists = data.relationships.some(
      (r) => r.sourceId === sourceId && r.targetId === targetId && r.type === type
    );
    if (exists) return null;
    data.relationships.push(rel);
  });
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
  await mutateJson<EmailsData>("emails.json", defaultEmails, (data) => {
    const email = data.emails.find((e) => e.id === id);
    if (!email) return null;
    email.unread = false;
  });
}

export async function getCalendar(): Promise<CalendarEvent[]> {
  const concerts = await getConcerts();
  const calendarData = await readJsonSafe<{ events: CalendarEvent[] }>("calendar.json", { events: [] });
  return [
    ...concerts.events.map((evt) => ({
      id: evt.id,
      title: `Concert : ${evt.artist}`,
      date: evt.date,
      venue: evt.venue,
      type: "concert" as const,
    })),
    ...calendarData.events,
  ];
}

export async function addCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
  const newEvent: CalendarEvent = {
    ...event,
    id: crypto.randomUUID?.() ?? String(Date.now()),
  };

  if (event.type === "concert") {
    await mutateJson<ConcertsData>("concerts.json", defaultConcerts, (data) => {
      data.events.push({
        id: newEvent.id,
        artist: event.title.replace(/^Concert :\s*/i, ""),
        venue: event.venue ?? "",
        date: event.date,
        status: "shooted",
      });
    });
  } else {
    await mutateJson<{ events: CalendarEvent[] }>("calendar.json", { events: [] }, (data) => {
      data.events.push(newEvent);
    });
    await maybeBackup("calendar.json");
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

// Anti-SSRF : n'autorise que des URLs http(s) publiques. Bloque les adresses
// privées/réservées (localhost, RFC1918, link-local, metadata cloud) pour que
// le fetch automatique d'URLs utilisateur ne puisse pas atteindre le réseau
// interne ni les endpoints de métadonnées cloud.
// Si la résolution DNS échoue (hors-ligne), on laisse le fetch décider :
// une cible injoignable échouera naturellement sans exposer le réseau interne.
async function isSafeFetchUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost") return false;

  const isIpLiteral = /^[\d.]+$/.test(hostname) || hostname.includes(":");
  if (isIpLiteral) {
    return ![
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^169\.254\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^0\./,
      /^::1$/,
      /^fe80:/,
      /^fc00:/,
      /^fd/,
    ].some((p) => p.test(hostname));
  }

  // Hostname DNS : refuser si l'une des adresses résolues est privée.
  try {
    const { lookup } = await import("dns/promises");
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return !addresses.some(({ address }) => {
      const a = address.toLowerCase();
      return (
        a === "::1" ||
        a.startsWith("127.") ||
        a.startsWith("10.") ||
        a.startsWith("192.168.") ||
        a.startsWith("169.254.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(a) ||
        a.startsWith("fe80:") ||
        a.startsWith("fc") ||
        a.startsWith("fd")
      );
    });
  } catch {
    return true;
  }
}

export async function fetchPageMeta(url: string): Promise<{ title: string; thumbnail?: string }> {
  if (!(await isSafeFetchUrl(url))) {
    return { title: "URL non autorisée (adresse privée ou invalide)" };
  }
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
  const reminder: Reminder = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    title: input.title.trim(),
    notes: input.notes?.trim() || undefined,
    dueAt: input.dueAt,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recurrence: input.recurrence,
  };
  await mutateJson<RemindersData>("reminders.json", defaultReminders, (data) => {
    data.reminders.unshift(reminder);
  });
  return reminder;
}

export async function updateReminder(id: string, updates: Partial<Pick<Reminder, "title" | "notes" | "dueAt" | "status" | "notifiedAt" | "recurrence" | "microsoftTaskId" | "microsoftListId">>): Promise<Reminder | null> {
  let updated: Reminder | null = null;
  await mutateJson<RemindersData>("reminders.json", defaultReminders, (data) => {
    const idx = data.reminders.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    data.reminders[idx] = { ...data.reminders[idx], ...updates, updatedAt: new Date().toISOString() };
    updated = data.reminders[idx];
  });
  return updated;
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
  let deleted = false;
  await mutateJson<RemindersData>("reminders.json", defaultReminders, (data) => {
    const before = data.reminders.length;
    data.reminders = data.reminders.filter((r) => r.id !== id);
    deleted = data.reminders.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
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
  const item: WatchLaterItem = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    url: input.url,
    title: input.title,
    description: input.description,
    thumbnail: input.thumbnail,
    read: false,
    source: input.source || detectSource(input.url),
    category: input.category || detectCategory(input.url),
    createdAt: new Date().toISOString(),
  };
  await mutateJson<WatchLaterData>("watch-later.json", defaultWatchLater, (data) => {
    data.items.unshift(item);
  });
  return item;
}

export async function updateWatchLaterItem(id: string, updates: Partial<Pick<WatchLaterItem, "title" | "description" | "category" | "summary" | "aiTags" | "read">>): Promise<WatchLaterItem | null> {
  let updated: WatchLaterItem | null = null;
  await mutateJson<WatchLaterData>("watch-later.json", defaultWatchLater, (data) => {
    const idx = data.items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    data.items[idx] = { ...data.items[idx], ...updates };
    updated = data.items[idx];
  });
  return updated;
}

export async function deleteWatchLaterItem(id: string): Promise<boolean> {
  let deleted = false;
  await mutateJson<WatchLaterData>("watch-later.json", defaultWatchLater, (data) => {
    const before = data.items.length;
    data.items = data.items.filter((i) => i.id !== id);
    deleted = data.items.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
}

export async function reorderWatchLaterItems(orderedIds: string[]): Promise<boolean> {
  await mutateJson<WatchLaterData>("watch-later.json", defaultWatchLater, (data) => {
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
  });
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
  await mutateJson<WatchLaterData>("watch-later.json", defaultWatchLater, (data) => {
    const idx = data.items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    data.items[idx] = { ...data.items[idx], read: true };
  });
}

export async function autoSummarize(url: string, title: string): Promise<{ summary: string; tags: string[] }> {
  if (!(await isSafeFetchUrl(url))) {
    return { summary: "", tags: [] };
  }
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
  const entry: ActivityEntry = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    action,
    label,
    details,
    createdAt: new Date().toISOString(),
  };
  await mutateJson<ActivityData>("activity.json", defaultActivity, (data) => {
    data.entries.unshift(entry);
    if (data.entries.length > MAX_ACTIVITY_ENTRIES) {
      data.entries = data.entries.slice(0, MAX_ACTIVITY_ENTRIES);
    }
  });
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
  await mutateJson<AccreditationsData>("accreditations.json", defaultAccreditations, (data) => {
    data.accreditations.unshift(accreditation);
  });
  return accreditation;
}

export async function updateAccreditation(
  id: string,
  updates: Partial<Pick<Accreditation, "status" | "notes" | "contactEmail">>
): Promise<Accreditation | null> {
  let updated: Accreditation | null = null;
  await mutateJson<AccreditationsData>("accreditations.json", defaultAccreditations, (data) => {
    const idx = data.accreditations.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    data.accreditations[idx] = { ...data.accreditations[idx], ...updates, updatedAt: new Date().toISOString() };
    updated = data.accreditations[idx];
  });
  return updated;
}

export async function deleteAccreditation(id: string): Promise<boolean> {
  let deleted = false;
  await mutateJson<AccreditationsData>("accreditations.json", defaultAccreditations, (data) => {
    const before = data.accreditations.length;
    data.accreditations = data.accreditations.filter((a) => a.id !== id);
    deleted = data.accreditations.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
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
  session.updatedAt = new Date().toISOString();
  await mutateJson<ChatHistory>("chat-history.json", defaultChatHistory, (data) => {
    const idx = data.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      data.sessions[idx] = session;
    } else {
      data.sessions.push(session);
    }
  });
}

export async function deleteChatSession(id: string): Promise<boolean> {
  let deleted = false;
  await mutateJson<ChatHistory>("chat-history.json", defaultChatHistory, (data) => {
    const before = data.sessions.length;
    data.sessions = data.sessions.filter((s) => s.id !== id);
    deleted = data.sessions.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
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
  status?: PhotoShootStatus;
}): Promise<PhotoShoot> {
  const now = new Date().toISOString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const shootDate = new Date(input.date + "T00:00:00");
  const isPast = !Number.isNaN(shootDate.getTime()) && shootDate <= today;
  const defaultStatus: PhotoShootStatus = isPast ? "done" : "upcoming";
  const shoot: PhotoShoot = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    title: input.title,
    date: input.date,
    client: input.client,
    status: input.status ?? defaultStatus,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  await mutateJson<PhotoShootsData>("photo-shoots.json", defaultPhotoShoots, (data) => {
    data.shoots.unshift(shoot);
  });
  return shoot;
}

export async function updatePhotoShoot(
  id: string,
  updates: Partial<Pick<PhotoShoot, "status" | "notes" | "galleryLink" | "photosSent" | "title" | "date" | "client">>
): Promise<PhotoShoot | null> {
  let updated: PhotoShoot | null = null;
  await mutateJson<PhotoShootsData>("photo-shoots.json", defaultPhotoShoots, (data) => {
    const idx = data.shoots.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    data.shoots[idx] = { ...data.shoots[idx], ...updates, updatedAt: new Date().toISOString() };
    updated = data.shoots[idx];
  });
  return updated;
}

export async function deletePhotoShoot(id: string): Promise<boolean> {
  let deleted = false;
  await mutateJson<PhotoShootsData>("photo-shoots.json", defaultPhotoShoots, (data) => {
    const before = data.shoots.length;
    data.shoots = data.shoots.filter((s) => s.id !== id);
    deleted = data.shoots.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
}

/* ───── Intentions (relances programmées) ───── */

const defaultIntentions: IntentionsData = { intentions: [] };

export async function getIntentions(): Promise<IntentionsData> {
  return readOrCreate("intentions.json", defaultIntentions);
}

export async function addIntention(input: {
  subject: string;
  message?: string;
  dueAt: string;
}): Promise<Intention> {
  const intention: Intention = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    subject: input.subject.trim(),
    message: input.message?.trim() || undefined,
    dueAt: input.dueAt,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await mutateJson<IntentionsData>("intentions.json", defaultIntentions, (data) => {
    data.intentions.unshift(intention);
  });
  return intention;
}

export async function listPendingIntentions(): Promise<Intention[]> {
  const data = await getIntentions();
  return data.intentions.filter((i) => i.status === "pending");
}

export async function resolveIntention(
  id: string,
  status: "done" | "cancelled"
): Promise<boolean> {
  let resolved = false;
  await mutateJson<IntentionsData>("intentions.json", defaultIntentions, (data) => {
    const idx = data.intentions.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    data.intentions[idx] = {
      ...data.intentions[idx],
      status,
      resolvedAt: new Date().toISOString(),
    };
    resolved = true;
  });
  return resolved;
}
