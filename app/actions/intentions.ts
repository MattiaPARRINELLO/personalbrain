"use server";

import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { resolveIntention, getIntentions } from "@/lib/storage";

export async function cancelIntention(id: string): Promise<boolean> {
  await requireSession();
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const ok = await resolveIntention(id, "cancelled");
  revalidatePath("/week");
  return ok;
}

export async function loadIntentions() {
  await requireSession();
  return getIntentions();
}
