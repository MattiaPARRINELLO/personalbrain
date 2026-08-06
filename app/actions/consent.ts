"use server";

import { requireSession } from "@/lib/session";
import { getAiConsent, setAiConsent, type ConsentState } from "@/lib/consent";

export async function loadAiConsent(): Promise<ConsentState> {
  await requireSession();
  return getAiConsent();
}

export async function acceptAiConsent(accepted: boolean): Promise<ConsentState> {
  await requireSession();
  return setAiConsent(accepted);
}
