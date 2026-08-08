import { describe, it, expect } from "vitest";
import { findFreeSlots } from "@/lib/leetcode-utils";

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
