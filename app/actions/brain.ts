"use server";

import { revalidatePath } from "next/cache";
import {
  addMemoryFact,
  deleteMemoryFact,
  getMemory,
  saveMemory,
  updateMemoryFact,
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
  revalidatePath("/brain");
  return fact;
}

export async function editMemoryFact(
  id: string,
  updates: Partial<Pick<MemoryFact, "content" | "category">>
): Promise<MemoryFact | null> {
  const f = await updateMemoryFact(id, updates);
  revalidatePath("/brain");
  return f;
}

export async function forgetFact(id: string): Promise<boolean> {
  const ok = await deleteMemoryFact(id);
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
