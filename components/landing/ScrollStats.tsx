"use client";

import { useEffect, useRef, useState } from "react";

type Stat = { value: number; label: string; suffix: string };

/**
 * Les stats racontent le voyage : au fil du scroll, chaque chiffre devient une
 * étape distincte (1/4, 2/4...) qui s'affiche en grand. Pas d'interpolation
 * continue : un waypoint à la fois, lisible et narratif.
 */
export function ScrollStats({ stats }: { stats: Stat[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stepRef = useRef(0);
  const [step, setStep] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? stats.length - 1
      : 0
  );
  const [tilt, setTilt] = useState(0);

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
      const total = rect.height + vh;
      const passed = vh * 0.75 - rect.top;
      const p = Math.min(Math.max(passed / total, 0), 1);
      const next = Math.round(p * (stats.length - 1));
      if (next !== stepRef.current) {
        stepRef.current = next;
        setStep(next);
      }
      // Le panneau se redresse quand on le traverse
      setTilt(16 * (1 - p));
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

  const current = stats[step];

  return (
    <section
      ref={sectionRef}
      className="[perspective:1400px] scroll-mt-20"
    >
      <div
        className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] overflow-hidden"
        style={{
          transform: `rotateX(${tilt}deg)`,
          transformOrigin: "center bottom",
          willChange: "transform",
        }}
      >
        <div className="px-6 sm:px-10 py-12 sm:py-16 flex flex-col items-center text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-[var(--text-4)]">
            Étape {step + 1} / {stats.length} · déjà en production
          </p>
          <div key={step} className="fade-in-up mt-6">
            <p className="font-display text-[64px] sm:text-[96px] font-black tracking-tight text-[var(--text-1)] tabular-nums leading-none">
              {current.value}
              <span className="text-[var(--accent)]">{current.suffix}</span>
            </p>
            <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--text-3)]">
              {current.label}
            </p>
          </div>
          <div className="mt-8 flex items-center gap-2" aria-hidden>
            {stats.map((s, i) => (
              <span
                key={s.label}
                className={
                  i === step
                    ? "h-1 w-8 rounded-full bg-[var(--accent)]"
                    : "h-1 w-8 rounded-full bg-[var(--border-2)]"
                }
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
