"use server";

import {
  getConcerts,
  getMemory,
  getEmails,
  getReminders,
  getWatchLater,
  getAccreditations,
  searchEmails,
} from "@/lib/storage";
import type { ConcertEvent, MemoryFact, Email, Reminder, WatchLaterItem, Accreditation } from "@/lib/types";

export interface UnifiedSearchResult {
  concerts: ConcertEvent[];
  facts: MemoryFact[];
  emails: Email[];
  reminders: Reminder[];
  watchLater: WatchLaterItem[];
  accreditations: Accreditation[];
}

export async function unifiedSearch(query: string): Promise<UnifiedSearchResult> {
  const q = query.toLowerCase().trim();
  if (!q) return { concerts: [], facts: [], emails: [], reminders: [], watchLater: [], accreditations: [] };

  const [concerts, memory, , reminders, watchLater, accreditations] = await Promise.all([
    getConcerts(),
    getMemory(),
    getEmails(),
    getReminders(),
    getWatchLater(),
    getAccreditations(),
  ]);

  const filteredEmails = await searchEmails(query);

  return {
    concerts: concerts.events.filter(
      (c) =>
        c.artist.toLowerCase().includes(q) ||
        c.venue.toLowerCase().includes(q)
    ),
    facts: memory.facts.filter(
      (f) =>
        f.content.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    ),
    emails: filteredEmails,
    reminders: reminders.reminders.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q))
    ),
    watchLater: watchLater.items.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        (w.description && w.description.toLowerCase().includes(q)) ||
        (w.aiTags && w.aiTags.some((t) => t.toLowerCase().includes(q)))
    ),
    accreditations: accreditations.accreditations.filter(
      (a) =>
        a.artist.toLowerCase().includes(q) ||
        a.venue.toLowerCase().includes(q) ||
        (a.notes && a.notes.toLowerCase().includes(q))
    ),
  };
}
