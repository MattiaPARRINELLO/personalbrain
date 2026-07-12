import type { CalendarEvent } from "./types";

export function findFreeSlots(events: CalendarEvent[], now: Date): { start: Date; end: Date; duration: number }[] {
  if (events.length === 0) {
    const end = new Date(now);
    end.setHours(23, 59, 0, 0);
    return [{ start: now, end, duration: (end.getTime() - now.getTime()) / 60000 }];
  }
  const slots: { start: Date; end: Date; duration: number }[] = [];
  const dayStart = new Date(now);
  dayStart.setHours(8, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 0, 0, 0);
  let cursor = now > dayStart ? now : dayStart;
  const sorted = events
    .map((e) => ({ start: new Date(e.date), end: new Date(new Date(e.date).getTime() + 3600000) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const ev of sorted) {
    if (cursor < ev.start) {
      const duration = (ev.start.getTime() - cursor.getTime()) / 60000;
      if (duration >= 15) slots.push({ start: cursor, end: ev.start, duration });
    }
    if (ev.end > cursor) cursor = ev.end;
  }
  if (cursor < dayEnd) {
    const duration = (dayEnd.getTime() - cursor.getTime()) / 60000;
    if (duration >= 15) slots.push({ start: cursor, end: dayEnd, duration });
  }
  return slots;
}
