"use server";

import { revalidatePath } from "next/cache";
import {
  addMemoryFact,
  deleteMemoryFact,
  getMemory,
  saveMemory,
  updateMemoryFact,
  logActivity,
} from "@/lib/storage";
import type { MemoryCategory, MemoryData, MemoryFact } from "@/lib/types";

export async function loadBrain(): Promise<MemoryData> {
  return getMemory();
}

export async function rememberFact(
  content: string,
  category: MemoryCategory
): Promise<MemoryFact> {
  if (!content?.trim()) throw new Error("Contenu requis");
  const fact = await addMemoryFact(content.trim(), category);
  await logActivity("memory_added", `Mémorisé : ${content.trim().slice(0, 80)}`, category);
  revalidatePath("/brain");
  return fact;
}

export async function editMemoryFact(
  id: string,
  updates: Partial<Pick<MemoryFact, "content" | "category">>
): Promise<MemoryFact | null> {
  const f = await updateMemoryFact(id, updates);
  if (f) await logActivity("memory_updated", `Fait modifié : ${f.content.slice(0, 80)}`);
  revalidatePath("/brain");
  return f;
}

export async function forgetFact(id: string): Promise<boolean> {
  const ok = await deleteMemoryFact(id);
  if (ok) await logActivity("memory_deleted", "Fait supprimé", id);
  revalidatePath("/brain");
  return ok;
}

export async function updateProfile(input: { name?: string; preferences?: string[] }): Promise<MemoryData> {
  const data = await getMemory();
  const next: MemoryData = {
    ...data,
    profile: {
      name: input.name?.trim() || data.profile.name,
      preferences: input.preferences ?? data.profile.preferences,
    },
  };
  await saveMemory(next);
  revalidatePath("/brain");
  return next;
}
