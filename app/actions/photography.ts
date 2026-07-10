"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getPhotoShoots,
  addPhotoShoot,
  updatePhotoShoot,
  deletePhotoShoot,
  logActivity,
} from "@/lib/storage";
import type { PhotoShootStatus } from "@/lib/types";

const createPhotoShootSchema = z.object({
  title: z.string().trim().min(1, "Titre requis"),
  date: z.string().trim().min(1, "Date requise"),
  client: z.string().trim().min(1, "Client requis"),
  notes: z.string().trim().optional(),
});

const photoShootStatusSchema = z.enum([
  "upcoming", "done", "on_pc", "sorted", "edited", "exported", "sent",
]);

const updatePhotoShootSchema = z
  .object({
    status: photoShootStatusSchema.optional(),
    title: z.string().trim().optional(),
    date: z.string().trim().optional(),
    client: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    galleryLink: z.string().url("Lien invalide").optional().or(z.literal("")),
    photosSent: z.number().int().min(0).optional(),
  })
  .strict();

export async function loadPhotoShoots() {
  return getPhotoShoots();
}

export async function createPhotoShoot(input: {
  title: string;
  date: string;
  client: string;
  notes?: string;
}) {
  const parsed = createPhotoShootSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const data = parsed.data;
  const shoot = await addPhotoShoot(data);
  await logActivity("shoot_created", `Shooting : ${shoot.title} — ${shoot.client}`, shoot.date);
  revalidatePath("/photos");
  return shoot;
}

export async function editPhotoShoot(
  id: string,
  updates: Partial<{
    status: PhotoShootStatus;
    title: string;
    date: string;
    client: string;
    notes: string;
    galleryLink: string;
    photosSent: number;
  }>
) {
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const parsed = updatePhotoShootSchema.safeParse(updates);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const data = parsed.data;
  const shoot = await updatePhotoShoot(id, {
    ...data,
    galleryLink: data.galleryLink || undefined,
  });
  if (shoot) await logActivity("shoot_updated", `Shooting mis à jour : ${shoot.title}`, shoot.status);
  revalidatePath("/photos");
  return shoot;
}

export async function removePhotoShoot(id: string): Promise<boolean> {
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const ok = await deletePhotoShoot(id);
  if (ok) await logActivity("shoot_deleted", "Shooting supprimé", id);
  revalidatePath("/photos");
  return ok;
}
