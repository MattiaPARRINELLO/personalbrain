"use server";

import { requireSession } from "@/lib/session";

import { getConcerts, saveConcerts, logActivity } from "@/lib/storage";
import type { ConcertsData, ConcertEvent } from "@/lib/types";

export async function loadConcerts(): Promise<ConcertsData> {
  await requireSession();
  return getConcerts();
}

export async function saveConcertEvents(events: ConcertEvent[]): Promise<void> {
  await requireSession();
  await saveConcerts({ events });
  await logActivity("concert_updated", `Concerts mis à jour (${events.length} événements)`);
}
