"use server";

import { revalidatePath } from "next/cache";
import {
  addWatchLaterItem,
  deleteWatchLaterItem,
  getWatchLater,
  updateWatchLaterItem,
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
  revalidatePath("/watch-later");
  return item;
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
  revalidatePath("/watch-later");
  return ok;
}
