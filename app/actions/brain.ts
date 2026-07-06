"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addMemoryFact,
  deleteMemoryFact,
  findSimilarMemoryFacts,
  getMemory,
  getMemoryRelationships,
  saveMemory,
  touchMemoryFact,
  updateMemoryFact,
  logActivity,
} from "@/lib/storage";
import type { MemoryCategory, MemoryData, MemoryFact, MemoryRelationship, MemorySource } from "@/lib/types";

const memoryCategorySchema = z.enum(["dev", "photo", "life", "preference"]);

const rememberFactSchema = z.object({
  content: z.string().trim().min(1, "Contenu requis"),
  category: memoryCategorySchema,
  source: z.enum(["manual", "tool", "auto-extract"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const autoExtractSchema = z.object({
  facts: z
    .array(
      z.object({
        content: z.string().trim().min(1),
        category: memoryCategorySchema,
        confidence: z.number().min(0).max(1),
      })
    )
    .max(8),
});

const updateMemorySchema = z
  .object({
    content: z.string().trim().min(1).optional(),
    category: memoryCategorySchema.optional(),
  })
  .strict();

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    preferences: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

export async function loadBrain(): Promise<MemoryData> {
  return getMemory();
}

export async function rememberFact(
  content: string,
  category: MemoryCategory,
  options?: { source?: MemorySource; confidence?: number }
): Promise<MemoryFact> {
  const parsed = rememberFactSchema.safeParse({ content, category, ...options });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const existing = await findSimilarMemoryFacts(parsed.data.content, parsed.data.category);
  if (existing) {
    await touchMemoryFact(existing.id);
    revalidatePath("/brain");
    return existing;
  }
  const fact = await addMemoryFact(parsed.data.content, parsed.data.category, {
    source: parsed.data.source,
    confidence: parsed.data.confidence,
  });
  await logActivity("memory_added", `Mémorisé : ${parsed.data.content.slice(0, 80)}`, parsed.data.category);
  revalidatePath("/brain");
  return fact;
}

export async function autoExtractMemoryFacts(
  raw: { facts: { content: string; category: MemoryCategory; confidence: number }[] }
): Promise<MemoryFact[]> {
  const parsed = autoExtractSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const saved: MemoryFact[] = [];
  for (const f of parsed.data.facts) {
    if (f.confidence < 0.7) continue;
    const existing = await findSimilarMemoryFacts(f.content, f.category);
    if (existing) {
      await touchMemoryFact(existing.id);
      saved.push(existing);
      continue;
    }
    const fact = await addMemoryFact(f.content, f.category, {
      source: "auto-extract",
      confidence: f.confidence,
    });
    await logActivity("memory_added", `Mémorisé : ${f.content.slice(0, 80)}`, f.category);
    saved.push(fact);
  }
  if (saved.length > 0) revalidatePath("/brain");
  return saved;
}

export async function editMemoryFact(
  id: string,
  updates: Partial<Pick<MemoryFact, "content" | "category">>
): Promise<MemoryFact | null> {
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const parsed = updateMemorySchema.safeParse(updates);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const f = await updateMemoryFact(id, parsed.data);
  if (f) await logActivity("memory_updated", `Fait modifié : ${f.content.slice(0, 80)}`);
  revalidatePath("/brain");
  return f;
}

export async function forgetFact(id: string): Promise<boolean> {
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const ok = await deleteMemoryFact(id);
  if (ok) await logActivity("memory_deleted", "Fait supprimé", id);
  revalidatePath("/brain");
  return ok;
}

export async function loadMemoryRelationships(): Promise<MemoryRelationship[]> {
  return getMemoryRelationships();
}

export async function updateProfile(input: { name?: string; preferences?: string[] }): Promise<MemoryData> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const data = await getMemory();
  const next: MemoryData = {
    ...data,
    profile: {
      name: parsed.data.name ?? data.profile.name,
      preferences: parsed.data.preferences ?? data.profile.preferences,
    },
  };
  await saveMemory(next);
  revalidatePath("/brain");
  return next;
}
