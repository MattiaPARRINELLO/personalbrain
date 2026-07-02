"use server";

import { getConcerts, saveConcerts } from "@/lib/storage";
import type { ConcertsData, ConcertEvent } from "@/lib/types";

export async function loadConcerts(): Promise<ConcertsData> {
  return getConcerts();
}

export async function saveConcertEvents(events: ConcertEvent[]): Promise<void> {
  await saveConcerts({ events });
}
