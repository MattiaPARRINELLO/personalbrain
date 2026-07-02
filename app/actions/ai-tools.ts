"use server";

import { addCalendarEvent, getCalendar, getEmails, searchEmails, webSearch } from "@/lib/storage";
import type { CalendarEvent, Email } from "@/lib/types";

export async function loadCalendar(): Promise<CalendarEvent[]> {
  return getCalendar();
}

export async function createCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
  return addCalendarEvent(event);
}

export async function loadEmails(): Promise<Email[]> {
  const data = await getEmails();
  return data.emails;
}

export async function findEmails(query: string): Promise<Email[]> {
  return searchEmails(query);
}

export async function searchWeb(query: string): Promise<string> {
  return webSearch(query);
}
