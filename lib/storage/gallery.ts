import type { GalleryData, GalleryItem } from "../types";
import { maybeBackup, mutateJson, readOrCreate, writeJsonAtomic } from "../storage-core";

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
