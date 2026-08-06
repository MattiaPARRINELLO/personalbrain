"use server";

import { requireSession } from "@/lib/session";

import { addCalendarEvent, getCalendar, getEmails, searchEmails, webSearch } from "@/lib/storage";
import type { CalendarEvent, Email } from "@/lib/types";

export async function loadCalendar(): Promise<CalendarEvent[]> {
  await requireSession();
  return getCalendar();
}

export async function createCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
  await requireSession();
  return addCalendarEvent(event);
}

export async function loadEmails(): Promise<Email[]> {
  await requireSession();
  const data = await getEmails();
  return data.emails;
}

export async function findEmails(query: string): Promise<Email[]> {
  await requireSession();
  return searchEmails(query);
}

export async function searchWeb(query: string): Promise<string> {
  await requireSession();
  return webSearch(query);
}
