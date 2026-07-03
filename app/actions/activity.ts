"use server";

import { getActivity } from "@/lib/storage";
import type { ActivityEntry } from "@/lib/types";

export async function loadActivity(limit = 50): Promise<ActivityEntry[]> {
  return getActivity(limit);
}
