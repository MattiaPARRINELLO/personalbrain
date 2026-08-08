import type { CalendarEvent } from "@/lib/api-client";

export const EVENT_COLORS: Record<string, { bg: string; fg: string; name: string }> = {
  "1":  { bg: "#a4bdfc", fg: "#1d1d1d", name: "Lavande" },
  "2":  { bg: "#7ae7bf", fg: "#1d1d1d", name: "Sauge" },
  "3":  { bg: "#dbadff", fg: "#1d1d1d", name: "Raisin" },
  "4":  { bg: "#ff887c", fg: "#1d1d1d", name: "Flamant" },
  "5":  { bg: "#fbd75b", fg: "#1d1d1d", name: "Banane" },
  "6":  { bg: "#ffb878", fg: "#1d1d1d", name: "Mandarine" },
  "7":  { bg: "#46d6db", fg: "#1d1d1d", name: "Paon" },
  "8":  { bg: "#e1e1e1", fg: "#1d1d1d", name: "Graphite" },
  "9":  { bg: "#5484ed", fg: "#ffffff", name: "Myrtille" },
  "10": { bg: "#51b749", fg: "#1d1d1d", name: "Basilic" },
  "11": { bg: "#dc2127", fg: "#ffffff", name: "Tomate" },
};

export const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function isAllDay(evt: CalendarEvent): boolean {
  return !evt.start.includes("T");
}

export function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((dayStart(a).getTime() - dayStart(b).getTime()) / (24 * 60 * 60 * 1000));
}

export function eventEndInclusive(evt: CalendarEvent): Date {
  const end = new Date(evt.end);
  if (isAllDay(evt)) {
    return addDays(end, -1);
  }
  return end;
}

export function isMultiDay(evt: CalendarEvent): boolean {
  const start = dayStart(new Date(evt.start));
  const end = dayStart(eventEndInclusive(evt));
  return start.getTime() !== end.getTime();
}

export function isSpanningOrAllDay(evt: CalendarEvent): boolean {
  return isAllDay(evt) || isMultiDay(evt);
}

export function visibleSpan(evt: CalendarEvent, weekStart: Date): { startCol: number; endCol: number } | null {
  const weekEnd = addDays(weekStart, 7);
  const evtStart = new Date(evt.start);
  const evtEnd = eventEndInclusive(evt);

  const visibleStart = dayStart(evtStart) < dayStart(weekStart) ? weekStart : evtStart;
  const visibleEnd = dayStart(evtEnd) >= dayStart(weekEnd) ? addDays(weekEnd, -1) : evtEnd;

  if (dayStart(visibleStart) > dayStart(visibleEnd)) return null;

  const startCol = Math.max(0, diffDays(dayStart(visibleStart), weekStart));
  const endCol = Math.min(6, diffDays(dayStart(visibleEnd), weekStart));

  return { startCol, endCol };
}

export function layoutMultiDayLanes(events: CalendarEvent[], weekStart: Date): CalendarEvent[][] {
  const spans = events
    .map((e) => ({ evt: e, span: visibleSpan(e, weekStart) }))
    .filter((x): x is { evt: CalendarEvent; span: { startCol: number; endCol: number } } => x.span !== null)
    .sort((a, b) => a.span.startCol - b.span.startCol || a.evt.summary.localeCompare(b.evt.summary));

  const lanes: { evt: CalendarEvent; span: { startCol: number; endCol: number } }[][] = [];
  for (const item of spans) {
    let placed = false;
    for (const lane of lanes) {
      const last = lane[lane.length - 1];
      if (last.span.endCol < item.span.startCol) {
        lane.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([item]);
    }
  }
  return lanes.map((lane) => lane.map((i) => i.evt));
}

export function monthWeeks(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const weeks: { days: (number | null)[]; start: Date }[] = [];

  const current = new Date(year, month, 1 - startPad);
  while (current <= last) {
    const days: (number | null)[] = [];
    const weekStart = new Date(current);
    for (let i = 0; i < 7; i++) {
      days.push(current.getMonth() === month ? current.getDate() : null);
      current.setDate(current.getDate() + 1);
    }
    weeks.push({ days, start: weekStart });
  }

  return weeks;
}

export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function monthRangeKey(year: number, month: number): { timeMin: string; timeMax: string; cacheKey: string } {
  const first = new Date(year, month, 1);
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const start = new Date(year, month, 1 - startPad);
  start.setHours(0, 0, 0, 0);

  const last = new Date(year, month + 1, 0);
  const endPad = last.getDay() === 0 ? 0 : 7 - last.getDay();
  const end = new Date(year, month + 1, endPad);
  end.setHours(23, 59, 59, 999);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    cacheKey: `calendar:list:${start.toISOString()}:${end.toISOString()}`,
  };
}
