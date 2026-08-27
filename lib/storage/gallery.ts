import type { GalleryData, GalleryItem } from "../types";
import { mutateJson, readOrCreate } from "../storage-core";

export async function getGallery(): Promise<GalleryData> {
  return readOrCreate("gallery.json", { items: [] });
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
