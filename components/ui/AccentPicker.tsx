"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ACCENT_PALETTE } from "./ThemeApplier";

export function AccentPicker() {
  const [current, setCurrent] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("brain-accent") || "#a5b4fc" : "#a5b4fc"
  );

  function apply(color: string) {
    localStorage.setItem("brain-accent", color);
    document.documentElement.style.setProperty("--accent", color);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
    setCurrent(color);
  }

  return (
    <div className="flex items-center gap-2">
      {Object.entries(ACCENT_PALETTE).map(([color, name]) => (
        <button
          key={color}
          onClick={() => apply(color)}
          title={name}
          className={cn(
            "w-7 h-7 rounded-full border transition-all duration-200",
            current === color
              ? "border-[var(--text-1)] scale-110 ring-2 ring-[var(--accent)]/30"
              : "border-[var(--border-2)] hover:scale-110"
          )}
          style={{ backgroundColor: color }}
          aria-label={name}
        />
      ))}
    </div>
  );
}
