import { describe, it, expect } from "vitest";
import {
  isAllDay,
  eventEndInclusive,
  visibleSpan,
  layoutMultiDayLanes,
  monthWeeks,
  monthRangeKey,
} from "../calendar-utils";
import type { CalendarEvent } from "@/lib/api-client";

function evt(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "e1",
    summary: "Concert",
    start: "2026-07-15T20:00:00",
    end: "2026-07-15T23:00:00",
    ...overrides,
  };
}

// Semaine du lundi 13 juillet 2026 (col 0 = lundi).
const WEEK_START = new Date(2026, 6, 13);

describe("isAllDay", () => {
  it("détecte un événement journée entière (date sans heure)", () => {
    expect(isAllDay(evt({ start: "2026-07-15", end: "2026-07-16" }))).toBe(true);
    expect(isAllDay(evt({ start: "2026-07-15T20:00:00" }))).toBe(false);
  });
});

describe("eventEndInclusive", () => {
  it("ramène la fin d'un événement journée entière à la veille", () => {
    const end = eventEndInclusive(evt({ start: "2026-07-15", end: "2026-07-16" }));
    expect(end.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });
});

describe("visibleSpan", () => {
  it("place un événement de la semaine sur la bonne colonne", () => {
    // Mercredi 15 juillet 2026 → colonne 2.
    const span = visibleSpan(evt({ start: "2026-07-15T20:00:00" }), WEEK_START);
    expect(span).toEqual({ startCol: 2, endCol: 2 });
  });

  it("retourne null pour un événement hors de la semaine", () => {
    const span = visibleSpan(evt({ start: "2026-07-25T20:00:00" }), WEEK_START);
    expect(span).toBeNull();
  });

  it("tronque un événement multi-jours qui déborde de la semaine", () => {
    // Du lundi 13 au dimanche 19 juillet 2026 → colonnes 0..6.
    const span = visibleSpan(
      evt({ start: "2026-07-12T10:00:00", end: "2026-07-20T10:00:00" }),
      WEEK_START
    );
    expect(span).toEqual({ startCol: 0, endCol: 6 });
  });
});

describe("layoutMultiDayLanes", () => {
  it("met deux événements qui se chevauchent sur deux lignes", () => {
    const lanes = layoutMultiDayLanes(
      [
        evt({ id: "a", summary: "A", start: "2026-07-15", end: "2026-07-17" }),
        evt({ id: "b", summary: "B", start: "2026-07-16", end: "2026-07-18" }),
      ],
      WEEK_START
    );
    expect(lanes.length).toBe(2);
    expect(lanes[0].map((e) => e.id)).toEqual(["a"]);
    expect(lanes[1].map((e) => e.id)).toEqual(["b"]);
  });

  it("met deux événements disjoints sur la même ligne", () => {
    const lanes = layoutMultiDayLanes(
      [
        evt({ id: "a", summary: "A", start: "2026-07-13", end: "2026-07-14" }),
        evt({ id: "b", summary: "B", start: "2026-07-15", end: "2026-07-16" }),
      ],
      WEEK_START
    );
    expect(lanes.length).toBe(1);
    expect(lanes[0].map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("monthWeeks", () => {
  it("génère les semaines d'un mois avec padding", () => {
    // Juillet 2026 commence un mercredi (col 3) : 3 cases de padding avant le 1er.
    const weeks = monthWeeks(2026, 6);
    expect(weeks.length).toBeGreaterThanOrEqual(4);
    expect(weeks[0].days).toHaveLength(7);
    expect(weeks[0].days[0]).toBeNull(); // case padding avant le 1er
    expect(weeks[0].days[3]).toBe(1);
    const flat = weeks.flatMap((w) => w.days);
    expect(flat).toContain(31);
  });

  it("ne pad pas un mois qui commence un dimanche", () => {
    // Février 2026 commence un dimanche (col 0) : le 1er est la première case.
    const weeks = monthWeeks(2026, 1);
    expect(weeks[0].days[0]).toBe(1);
  });
});

describe("monthRangeKey", () => {
  it("calcule une fenêtre qui encadre le mois", () => {
    const { timeMin, timeMax } = monthRangeKey(2026, 6);
    expect(timeMin <= "2026-07-01T00:00:00.000Z").toBe(true);
    expect(timeMax >= "2026-07-31T23:59:59.999Z").toBe(true);
  });
});
