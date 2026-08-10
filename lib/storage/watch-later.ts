import type { WatchLaterCategory, WatchLaterData, WatchLaterItem } from "../types";
import { maybeBackup, mutateJson, readOrCreate, writeJsonAtomic } from "../storage-core";
import { isSafeFetchUrl, safeFetchText } from "../web";

const defaultWatchLater: WatchLaterData = { items: [] };

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
    // safeFetchText : redirections re-vérifiées (anti-SSRF) et corps limité.
    const html = await safeFetchText(url, 8000);
    if (!html) return { summary: "", tags: [] };

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

    const { chatCompletion } = await import("../ai-providers");
    const { getConfig } = await import("../config");
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
