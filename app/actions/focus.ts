"use server";

import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { getFocusState, startFocus, stopFocus, type FocusState } from "@/lib/focus";

export async function loadFocus(): Promise<FocusState> {
  await requireSession();
  return getFocusState();
}

export async function startFocusSession(durationMin: number): Promise<FocusState> {
  await requireSession();
  if (typeof durationMin !== "number" || Number.isNaN(durationMin)) {
    throw new Error("Durée invalide");
  }
  const state = await startFocus(durationMin);
  revalidatePath("/focus");
  return state;
}

export async function stopFocusSession(): Promise<FocusState> {
  await requireSession();
  const state = await stopFocus();
  revalidatePath("/focus");
  return state;
}
