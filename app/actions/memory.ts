"use server";

import { getMemory, addMemoryFact } from "@/lib/storage";
import type { MemoryData, MemoryFact } from "@/lib/types";

export async function loadMemory(): Promise<MemoryData> {
  return getMemory();
}

export async function rememberFact(content: string, category: MemoryFact["category"]): Promise<MemoryFact> {
  return addMemoryFact(content, category);
}
