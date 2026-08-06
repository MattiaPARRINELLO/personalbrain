"use server";

import { requireSession } from "@/lib/session";

import { getActivity } from "@/lib/storage";
import type { ActivityEntry } from "@/lib/types";

export async function loadActivity(limit = 50): Promise<ActivityEntry[]> {
  await requireSession();
  return getActivity(limit);
}
