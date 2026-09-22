import type { CalendarEvent } from "./types";

const DAY_MS = 86_400_000;

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

/**
 * Clé de jour `YYYY-MM-DD`. LeetCode date ses soumissions par minuit **UTC** :
 * tout le module raisonne donc en jours UTC, jamais en jours locaux.
 */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Le calendrier arrive sous forme de chaîne JSON `{ "<epoch secondes>": n }` et
 * ne contient **que les jours actifs** — un jour creux est un jour absent, pas
 * un zéro.
 */
export function parseSubmissionCalendar(raw: string): Record<string, number> {
  if (!raw) return {};
  const parsed = safeParseObject(raw);
  if (!parsed) return {};
  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([epoch, count]) => Number.isFinite(Number(epoch)) && Number(count) > 0)
      .map(([epoch, count]) => [dayKey(Number(epoch) * 1000), Number(count)] as const)
  );
}

function safeParseObject(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Série courante, recalculée depuis le calendrier plutôt que lue dans le champ
 * `streak` de l'API (dont la sémantique — série courante ou record — n'est pas
 * documentée, et qui restait figé en base). La journée en cours compte dès la
 * première soumission ; sinon la série s'arrête à hier, car elle n'est perdue
 * qu'une fois la journée terminée.
 */
export function computeStreak(calendar: Record<string, number>): number {
  const days = new Set(Object.keys(calendar));
  if (days.size === 0) return 0;

  const now = Date.now();
  const startOffset = days.has(dayKey(now))
    ? 0
    : days.has(dayKey(now - DAY_MS))
      ? 1
      : -1;
  if (startOffset < 0) return 0;

  // `days.size` borne la série : elle ne peut pas dépasser le nombre de jours actifs.
  const offsets = Array.from({ length: days.size }, (_, i) => startOffset + i);
  const broken = offsets.findIndex((offset) => !days.has(dayKey(now - offset * DAY_MS)));
  return broken === -1 ? offsets.length : broken;
}

export interface ActivityDay {
  key: string;
  count: number;
}

/**
 * Grille d'activité de `weeks` semaines, lundi → dimanche, alignée sur la
 * semaine en cours. Le calendrier de l'API ne contient que les jours actifs : on
 * reconstruit les jours creux pour que la grille garde une échelle régulière.
 * Les jours à venir de la semaine courante sont présents avec un compte nul.
 */
export function buildActivityGrid(calendar: Record<string, number>, weeks: number): ActivityDay[][] {
  const now = new Date();
  const mondayOffset = (now.getUTCDay() + 6) % 7;
  const mondayThisWeek = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - mondayOffset
  );
  const firstMonday = mondayThisWeek - (weeks - 1) * 7 * DAY_MS;

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const key = dayKey(firstMonday + (week * 7 + day) * DAY_MS);
      return { key, count: calendar[key] ?? 0 };
    })
  );
}

/** Niveau 0-4 d'une cellule d'activité, à seuils fixes (échelle lisible). */
export function activityLevel(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}
