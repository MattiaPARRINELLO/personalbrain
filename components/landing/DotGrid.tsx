"use client";

import { useEffect, useRef } from "react";

const ROWS = 20;
const COLS = 24;

/**
 * Grille de points en fond de page : chaque ligne s'allume quand elle passe
 * sous le haut du viewport au scroll. Créée une seule fois, pilotée par
 * toggle de classes (zéro re-render React par frame).
 */
export function DotGrid() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const rows = Array.from(grid.children) as HTMLDivElement[];

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rows.forEach((r) => r.classList.add("dot-grid-row-on"));
      return;
    }

    let raf = 0;
    const update = () => {
      const vh = window.innerHeight;
      const doc = document.documentElement;
      const max = Math.max(doc.scrollHeight - vh, 1);
      const p = Math.min(Math.max(window.scrollY / max, 0), 1);
      const lit = Math.round(p * ROWS);
      rows.forEach((r, i) => {
        r.classList.toggle("dot-grid-row-on", i < lit);
      });
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div ref={gridRef} className="relative h-full w-full">
        {Array.from({ length: ROWS }).map((_, r) => (
          <div key={r} className="dot-grid-row relative h-[5%] w-full">
            {Array.from({ length: COLS }).map((_, c) => (
              <span
                key={c}
                className="absolute block h-[3px] w-[3px] rounded-full bg-[var(--text-3)]"
                style={{
                  left: `${(c / COLS) * 100 + 50 / COLS}%`,
                  top: `${50 / ROWS}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
