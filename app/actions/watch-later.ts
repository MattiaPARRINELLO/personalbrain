"use server";

import { revalidatePath } from "next/cache";
import {
  addWatchLaterItem,
  autoSummarize,
  deleteWatchLaterItem,
  getWatchLater,
  updateWatchLaterItem,
  logActivity,
} from "@/lib/storage";
import type {
  WatchLaterCategory,
  WatchLaterData,
  WatchLaterItem,
} from "@/lib/types";

export async function loadWatchLater(): Promise<WatchLaterData> {
  return getWatchLater();
}

export async function createWatchLaterItem(input: {
  url: string;
  title: string;
  description?: string;
  thumbnail?: string;
  source?: string;
  category?: WatchLaterCategory;
}): Promise<WatchLaterItem> {
  if (!input.url?.trim()) throw new Error("URL requise");
  if (!input.title?.trim()) throw new Error("Titre requis");
  const item = await addWatchLaterItem(input);
  await logActivity("watch_later_added", `À voir : ${item.title}`, item.url);

  // Résumé IA en arrière-plan (non bloquant)
  Promise.allSettled([
    (async () => {
      const { summary, tags } = await autoSummarize(item.url, item.title);
      if (summary || tags.length > 0) {
        await updateWatchLaterItem(item.id, { summary, aiTags: tags });
        revalidatePath("/watch-later");
      }
    })(),
  ]);

  revalidatePath("/watch-later");
  return item;
}

export async function summarizeWatchLaterItem(
  id: string
): Promise<{ summary: string; tags: string[] } | null> {
  const data = await getWatchLater();
  const item = data.items.find((i) => i.id === id);
  if (!item) return null;

  const result = await autoSummarize(item.url, item.title);
  if (result.summary || result.tags.length > 0) {
    await updateWatchLaterItem(id, { summary: result.summary, aiTags: result.tags });
    revalidatePath("/watch-later");
  }
  return result;
}

export async function editWatchLaterItem(
  id: string,
  updates: Partial<Pick<WatchLaterItem, "title" | "description" | "category">>
): Promise<WatchLaterItem | null> {
  const item = await updateWatchLaterItem(id, updates);
  revalidatePath("/watch-later");
  return item;
}

export async function removeWatchLaterItem(id: string): Promise<boolean> {
  const ok = await deleteWatchLaterItem(id);
  if (ok) await logActivity("watch_later_deleted", "Élément retiré de À voir plus tard", id);
  revalidatePath("/watch-later");
  return ok;
}
