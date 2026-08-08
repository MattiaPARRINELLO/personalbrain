"use client";

import { useEffect, useRef, useState } from "react";

type Stat = { value: number; label: string; suffix: string };

/**
 * Un seul grand chiffre qui traverse les stats au fil du scroll : la valeur
 * affichée et son label suivent la progression de la section dans le viewport.
 */
export function NarrativeStats({ stats }: { stats: Stat[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const activeRef = useRef(0);
  const [display, setDisplay] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? stats[stats.length - 1].value
      : stats[0].value
  );
  const [active, setActive] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? stats.length - 1
      : 0
  );

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let raf = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh * 0.4;
      const passed = vh * 0.8 - rect.top;
      const p = Math.min(Math.max(passed / total, 0), 1);
      const idxF = p * (stats.length - 1);
      const i0 = Math.floor(idxF);
      const i1 = Math.min(i0 + 1, stats.length - 1);
      const frac = idxF - i0;
      setDisplay(Math.round(stats[i0].value + (stats[i1].value - stats[i0].value) * frac));
      const nearest = Math.round(idxF);
      if (nearest !== activeRef.current) {
        activeRef.current = nearest;
        setActive(nearest);
      }
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
  }, [stats]);

  const current = stats[active];

  return (
    <section
      ref={sectionRef}
      className="scroll-mt-20 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] overflow-hidden"
    >
      <div className="px-6 sm:px-10 py-12 sm:py-16 flex flex-col items-center text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-[var(--text-4)]">
          Déjà en production
        </p>
        <p className="mt-6 font-display text-[64px] sm:text-[96px] font-black tracking-tight text-[var(--text-1)] tabular-nums leading-none">
          {display}
          <span className="text-[var(--accent)]">{current.suffix}</span>
        </p>
        <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--text-3)]">
          {current.label}
        </p>
        <div className="mt-8 flex items-center gap-2" aria-hidden>
          {stats.map((s, i) => (
            <span
              key={s.label}
              className={i === active ? "h-1 w-8 rounded-full bg-[var(--accent)]" : "h-1 w-8 rounded-full bg-[var(--border-2)]"}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
