"use client";

import { useEffect } from "react";

const ACCENT_PALETTE: Record<string, string> = {
  "#a5b4fc": "Indigo",
  "#d4a373": "Ambre",
  "#7aa2f7": "Bleu",
  "#9d4edd": "Violet",
  "#f472b6": "Rose",
  "#34d399": "Vert",
  "#fb923c": "Orange",
};

export function ThemeApplier() {
  useEffect(() => {
    const saved = localStorage.getItem("brain-accent");
    if (saved && ACCENT_PALETTE[saved]) {
      document.documentElement.style.setProperty("--accent", saved);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", saved);
    }
  }, []);

  return null;
}

export { ACCENT_PALETTE };
