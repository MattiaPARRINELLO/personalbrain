"use server";

import { requireSession } from "@/lib/session";

import { getMemory, addMemoryFact } from "@/lib/storage";
import type { MemoryData, MemoryFact } from "@/lib/types";

export async function loadMemory(): Promise<MemoryData> {
  await requireSession();
  return getMemory();
}

export async function rememberFact(content: string, category: MemoryFact["category"]): Promise<MemoryFact> {
  await requireSession();
  return addMemoryFact(content, category);
}
