import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

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
