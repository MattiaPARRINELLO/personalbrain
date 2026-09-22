import { describe, it, expect } from "vitest";
import { cn, markdownToText } from "@/lib/utils";

describe("cn", () => {
  it("merge des classes simples", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("gère les classes conditionnelles", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("résout les conflits Tailwind (dernier gagne)", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("ignore les valeurs falsy", () => {
    expect(cn("", null, undefined, "block")).toBe("block");
  });
});

describe("markdownToText", () => {
  it("laisse un paragraphe simple intact", () => {
    expect(markdownToText("Tu as deux cours aujourd'hui.")).toBe("Tu as deux cours aujourd'hui.");
  });

  it("retire gras, puces, titres et liens", () => {
    const md = "## Résumé\n\n- **Maths** à 8h\n- [Mail](https://example.com) urgent";
    expect(markdownToText(md)).toBe("Résumé Maths à 8h Mail urgent");
  });

  it("aplatit un tableau et ses séparateurs", () => {
    const md = "| Heure | Cours |\n| --- | --- |\n| 8h | Maths |";
    expect(markdownToText(md)).toBe("Heure · Cours 8h · Maths");
  });
});
