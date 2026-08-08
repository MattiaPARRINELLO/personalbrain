import { describe, it, expect } from "vitest";
import {
  formatRelative,
  formatDateLong,
  formatDateShort,
  toLocalInputValue,
  fromLocalInputValue,
  isDue,
  isOverdue,
} from "@/lib/date";

describe("formatRelative", () => {
  it("retourne vide pour une date invalide", () => {
    expect(formatRelative("pas-une-date")).toBe("");
  });

  it("retourne 'il y a X secondes' pour un changement récent", () => {
    const now = new Date().toISOString();
    const result = formatRelative(now);
    expect(result).toMatch(/maintenant|il y a \d+ secondes/);
  });

  it("retourne 'il y a X minutes' pour un changement récent", () => {
    const past = new Date(Date.now() - 120_000).toISOString();
    const result = formatRelative(past);
    expect(result).toMatch(/il y a \d+ minutes/);
  });

  it("retourne 'dans X heures' pour un événement futur", () => {
    const future = new Date(Date.now() + 7200_000).toISOString();
    const result = formatRelative(future);
    expect(result).toMatch(/dans \d+ heures/);
  });

  it("retourne 'il y a X jours' pour 3 jours dans le passé", () => {
    const past = new Date(Date.now() - 3 * 86400_000).toISOString();
    const result = formatRelative(past);
    expect(result).toMatch(/il y a \d+ jours/);
  });

  it("retourne une date courte pour >30 jours", () => {
    const past = new Date(Date.now() - 40 * 86400_000).toISOString();
    const result = formatRelative(past);
    expect(result).not.toMatch(/il y a/);
    expect(result).toMatch(/^(\d{1,2} (janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc))/);
  });
});

describe("formatDateLong", () => {
  it("retourne vide pour une date invalide", () => {
    expect(formatDateLong("invalide")).toBe("");
  });

  it("formate une date ISO en français", () => {
    const date = new Date(2025, 0, 15, 14, 30).toISOString();
    const result = formatDateLong(date);
    expect(result).toContain("2025");
    expect(result).toContain("janvier");
  });
});

describe("formatDateShort", () => {
  it("retourne vide pour une date invalide", () => {
    expect(formatDateShort("invalide")).toBe("");
  });

  it("retourne l'heure pour aujourd'hui", () => {
    const now = new Date().toISOString();
    const result = formatDateShort(now);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it("retourne jour/mois pour une date ancienne", () => {
    const oldDate = new Date(2024, 5, 15, 14, 0).toISOString();
    const result = formatDateShort(oldDate);
    expect(result).toMatch(/^15/);
  });
});

describe("toLocalInputValue", () => {
  it("retourne vide pour une date invalide", () => {
    expect(toLocalInputValue("nope")).toBe("");
  });

  it("formate au format attendu par les inputs datetime-local", () => {
    const date = new Date(2025, 0, 15, 14, 30, 0).toISOString();
    const result = toLocalInputValue(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(result).toBe("2025-01-15T14:30");
  });
});

describe("fromLocalInputValue", () => {
  it("retourne une date ISO valide à partir d'une valeur d'input", () => {
    const result = fromLocalInputValue("2025-01-15T14:30");
    expect(result).toBe(new Date("2025-01-15T14:30").toISOString());
  });

  it("retourne la date courante pour une chaîne vide", () => {
    const result = fromLocalInputValue("");
    expect(() => new Date(result)).not.toThrow();
  });
});

describe("isDue", () => {
  it("retourne true pour une date passée", () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    expect(isDue(past)).toBe(true);
  });

  it("retourne false pour une date future", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(isDue(future)).toBe(false);
  });

  it("retourne false pour une date invalide", () => {
    expect(isDue("nope")).toBe(false);
  });
});

describe("isOverdue", () => {
  it("retourne true pour une date strictement passée", () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    expect(isOverdue(past)).toBe(true);
  });

  it("retourne false pour une date future", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(isOverdue(future)).toBe(false);
  });

  it("retourne false pour une date invalide", () => {
    expect(isOverdue("nope")).toBe(false);
  });

  it("retourne false pour la date courante (strictement inférieur)", () => {
    const now = new Date().toISOString();
    expect(isOverdue(now)).toBe(false);
  });
});
