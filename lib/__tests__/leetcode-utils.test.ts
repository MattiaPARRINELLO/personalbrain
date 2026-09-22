import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  activityLevel,
  buildActivityGrid,
  computeStreak,
  dayKey,
  findFreeSlots,
  parseSubmissionCalendar,
} from "@/lib/leetcode-utils";

function ev(start: string) {
  return { id: "e1", title: "t", date: start, type: "meeting" as const };
}

describe("findFreeSlots", () => {
  it("retourne un slot jusqu'à 23:59 si aucun event", () => {
    const now = new Date("2026-07-12T10:00:00");
    const slots = findFreeSlots([], now);
    expect(slots).toHaveLength(1);
    expect(slots[0].duration).toBeCloseTo(13 * 60 + 59 - 0.016, -1);
  });

  it("détecte un gap entre maintenant et le premier event", () => {
    const now = new Date("2026-07-12T10:00:00");
    const slots = findFreeSlots([ev("2026-07-12T12:00:00")], now);
    expect(slots).toHaveLength(2);
    expect(slots[0].duration).toBe(120);
    expect(slots[0].start.getTime()).toBe(now.getTime());
    expect(slots[0].end.getTime()).toBe(new Date("2026-07-12T12:00:00").getTime());
  });

  it("utilise dayStart si now < 8h", () => {
    const now = new Date("2026-07-12T07:00:00");
    const slots = findFreeSlots([ev("2026-07-12T10:00:00")], now);
    const dayStart = new Date(now);
    dayStart.setHours(8, 0, 0, 0);
    expect(slots[0].start.getTime()).toBe(dayStart.getTime());
  });

  it("ignore les gaps < 15min", () => {
    const now = new Date("2026-07-12T10:00:00");
    const slots = findFreeSlots([ev("2026-07-12T10:10:00")], now);
    // Gap de 10min < 15min, pas de slot avant l'event
    const beforeEvent = slots.find((s) => s.end.getTime() === new Date("2026-07-12T10:10:00").getTime());
    expect(beforeEvent).toBeUndefined();
  });

  it("ne crée pas de slot résiduel si cursor >= dayEnd", () => {
    const now = new Date("2026-07-12T22:00:00");
    const slots = findFreeSlots([ev("2026-07-12T22:00:00")], now);
    expect(slots.some((s) => s.start.getTime() >= new Date("2026-07-12T22:00:00").getTime() + 3600000)).toBe(false);
  });



  it("ne crée pas de slot résiduel < 15min avant dayEnd", () => {
    const now = new Date("2026-07-12T22:50:00");
    const slots = findFreeSlots([ev("2026-07-12T23:00:00")], now);
    // Gap de 10min < 15min avant 23h, pas de slot résiduel
    expect(slots.some((s) => s.start.getTime() > new Date("2026-07-12T23:00:00").getTime())).toBe(false);
  });

  it("merge les events qui se chevauchent", () => {
    const now = new Date("2026-07-12T10:00:00");
    const slots = findFreeSlots(
      [ev("2026-07-12T11:00:00"), ev("2026-07-12T11:30:00")],
      now
    );
    // Event 1: 11h-12h, Event 2: 11h30-12h30
    // cursor après les deux: 12h30
    // Gap avant 11h: 60min
    expect(slots).toHaveLength(2);
    expect(slots[0].duration).toBe(60);
  });

  it("gère des events triés dans le désordre", () => {
    const now = new Date("2026-07-12T10:00:00");
    const slots = findFreeSlots(
      [ev("2026-07-12T14:00:00"), ev("2026-07-12T12:00:00")],
      now
    );
    expect(slots).toHaveLength(3);
    expect(slots[0].duration).toBe(120); // 10h -> 12h (avant event 12h)
    expect(slots[1].duration).toBe(60);  // 13h -> 14h (event1 12-13h, event2 14-15h)
    expect(slots[2].duration).toBeGreaterThan(0); // 15h -> 23h
  });
});

describe("parseSubmissionCalendar", () => {
  it("convertit les epochs (secondes) en jours UTC", () => {
    expect(parseSubmissionCalendar('{"1787356800": 5}')).toEqual({ "2026-08-22": 5 });
  });

  it("renvoie un objet vide si la chaîne est absente ou invalide", () => {
    expect(parseSubmissionCalendar("")).toEqual({});
    expect(parseSubmissionCalendar("pas du json")).toEqual({});
    expect(parseSubmissionCalendar("[]")).toEqual({});
  });

  it("ignore les jours à zéro et les clés non numériques", () => {
    expect(parseSubmissionCalendar('{"1787356800": 0, "x": 3, "1787443200": 2}')).toEqual({
      "2026-08-23": 2,
    });
  });
});

describe("computeStreak", () => {
  // 2026-09-22 est un mardi : la grille d'activité s'aligne sur le lundi.
  const NOW = new Date("2026-09-22T10:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const activeDays = (...offsets: number[]) =>
    Object.fromEntries(offsets.map((o) => [dayKey(Date.now() - o * 86_400_000), 1]));

  it("compte la journée en cours", () => {
    expect(computeStreak(activeDays(0, 1, 2))).toBe(3);
  });

  it("reste vivante tant que la veille est active", () => {
    expect(computeStreak(activeDays(1, 2))).toBe(2);
  });

  it("vaut 0 quand hier et aujourd'hui sont creux", () => {
    expect(computeStreak(activeDays(2, 3))).toBe(0);
  });

  it("s'arrête au premier jour manquant", () => {
    expect(computeStreak(activeDays(0, 1, 3, 4))).toBe(2);
  });

  it("vaut 0 sans aucun jour actif", () => {
    expect(computeStreak({})).toBe(0);
  });
});

describe("buildActivityGrid", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aligne les semaines sur le lundi et finit sur la semaine en cours", () => {
    const grid = buildActivityGrid({}, 2);
    expect(grid).toHaveLength(2);
    expect(grid[1].map((d) => d.key)).toEqual([
      "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24",
      "2026-09-25", "2026-09-26", "2026-09-27",
    ]);
    expect(grid[0][0].key).toBe("2026-09-14");
  });

  it("remplit les jours creux à zéro et lit les jours actifs", () => {
    const grid = buildActivityGrid({ "2026-09-22": 4 }, 1);
    expect(grid[0][1]).toEqual({ key: "2026-09-22", count: 4 });
    expect(grid[0][0]).toEqual({ key: "2026-09-21", count: 0 });
  });
});

describe("activityLevel", () => {
  it("échelonne sur 5 niveaux à seuils fixes", () => {
    expect([0, 1, 2, 3, 4, 7, 20].map(activityLevel)).toEqual([0, 1, 2, 2, 3, 4, 4]);
  });
});
