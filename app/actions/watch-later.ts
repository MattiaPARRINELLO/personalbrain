"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addWatchLaterItem,
  autoSummarize,
  deleteWatchLaterItem,
  getWatchLater,
  reorderWatchLaterItems,
  updateWatchLaterItem,
  logActivity,
} from "@/lib/storage";
import type {
  WatchLaterCategory,
  WatchLaterData,
  WatchLaterItem,
} from "@/lib/types";

const watchLaterCategorySchema = z.enum(["video", "article", "photo", "music", "other"]);

const createWatchLaterSchema = z.object({
  url: z.string().trim().url("URL invalide"),
  title: z.string().trim().min(1, "Titre requis"),
  description: z.string().trim().optional(),
  thumbnail: z.string().trim().url().optional().or(z.literal("")),
  source: z.string().trim().optional(),
  category: watchLaterCategorySchema.optional(),
});

const updateWatchLaterSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    category: watchLaterCategorySchema.optional(),
  })
  .strict();

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
  const parsed = createWatchLaterSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const data = parsed.data;
  const item = await addWatchLaterItem({
    ...data,
    thumbnail: data.thumbnail ? data.thumbnail : undefined,
  });
  await logActivity("watch_later_added", `À voir : ${item.title}`, item.url);

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
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
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
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const parsed = updateWatchLaterSchema.safeParse(updates);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const item = await updateWatchLaterItem(id, parsed.data);
  revalidatePath("/watch-later");
  return item;
}

export async function removeWatchLaterItem(id: string): Promise<boolean> {
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const ok = await deleteWatchLaterItem(id);
  if (ok) await logActivity("watch_later_deleted", "Élément retiré de À voir plus tard", id);
  revalidatePath("/watch-later");
  return ok;
}

export async function reorderWatchLater(orderedIds: string[]): Promise<boolean> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error("Liste d'IDs invalide");
  }
  const ok = await reorderWatchLaterItems(orderedIds);
  revalidatePath("/watch-later");
  return ok;
}
