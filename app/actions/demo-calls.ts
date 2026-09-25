"use server";

import { requireSession } from "@/lib/session";
import { getDemoCalls } from "@/lib/storage";
import type { DemoCallEntry } from "@/lib/types";

export async function loadDemoCalls(limit = 1000): Promise<DemoCallEntry[]> {
  await requireSession();
  return getDemoCalls(limit);
}
