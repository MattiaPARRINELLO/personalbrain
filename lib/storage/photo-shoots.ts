import type { PhotoShoot, PhotoShootStatus, PhotoShootsData } from "../types";
import { maybeBackup, mutateJson, readOrCreate, writeJsonAtomic } from "../storage-core";

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
