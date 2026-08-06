"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type DayStep = {
  time: string;
  title: string;
  desc: string;
  artifact: React.ReactNode;
  accent: string;
};

function useSectionProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => setProgress(1));
      return () => cancelAnimationFrame(raf);
    }
    let raf = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const total = rect.height + window.innerHeight * 0.5;
      const passed = window.innerHeight * 0.6 - rect.top;
      setProgress(Math.min(Math.max(passed / total, 0), 1));
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
  }, [ref]);
  return progress;
}

function useStepReveal(ref: React.RefObject<HTMLElement | null>, index: number) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => setActive(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setActive(true);
          io.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, index]);
  return active;
}

function DayStepRow({
  step,
  index,
  onRef,
}: {
  step: DayStep;
  index: number;
  onRef: (el: HTMLDivElement | null, index: number) => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const reveal = useStepReveal(rowRef, index);

  return (
    <div
      ref={(el) => {
        rowRef.current = el;
        onRef(el, index);
      }}
      className={cn(
        "relative grid grid-cols-[auto_1fr] sm:grid-cols-[140px_1fr] gap-4 sm:gap-8 transition-all duration-700 ease-out",
        reveal ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
    >
      {/* Heure */}
      <div className="text-right sm:text-left">
        <span
          className={cn(
            "text-[12px] font-mono tabular-nums transition-colors duration-500",
            reveal ? "text-[var(--accent)]" : "text-[var(--text-4)]"
          )}
        >
          {step.time}
        </span>
      </div>

      {/* Contenu */}
      <div className="pb-12 sm:pb-16">
        <div
          className={cn(
            "rounded-2xl border bg-[var(--surface-1)] p-5 sm:p-6 transition-colors duration-500",
            reveal ? "border-[var(--border-2)]" : "border-[var(--border-1)]"
          )}
        >
          <h3 className="font-display text-[19px] sm:text-[21px] font-bold text-[var(--text-1)]">
            {step.title}
          </h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-3)]">{step.desc}</p>
          <div
            className={cn(
              "mt-5 transition-all duration-700 ease-out",
              reveal ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            {step.artifact}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DayTimeline({ steps }: { steps: DayStep[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const progress = useSectionProgress(sectionRef);

  const stepOffsets = steps.map((_, i) => i / Math.max(steps.length - 1, 1));

  return (
    <section ref={sectionRef} className="relative">
      {/* Ligne de progression — la signature du scroll */}
      <div className="absolute left-[52px] sm:left-[186px] top-2 bottom-2 w-px bg-[var(--border-2)]" aria-hidden />
      <div
        aria-hidden
        className="absolute left-[52px] sm:left-[186px] top-2 w-px bg-[var(--accent)]"
        style={{ height: `${progress * 100}%`, transition: "height 80ms linear" }}
      />

      <div className="flex flex-col">
        {steps.map((step, i) => (
          <div key={step.time} className="relative">
            {/* Point de la timeline */}
            <div
              className="absolute left-[46px] sm:left-[180px] top-[26px] w-[13px] h-[13px] -translate-x-1/2 rounded-full border-2 transition-all duration-500"
              style={{
                borderColor:
                  progress >= stepOffsets[i] ? "var(--accent)" : "var(--border-3)",
                background: progress >= stepOffsets[i] ? "var(--accent)" : "var(--surface-1)",
                boxShadow:
                  progress >= stepOffsets[i]
                    ? "0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent)"
                    : "none",
              }}
            />
            <DayStepRow
              step={step}
              index={i}
              onRef={(el, idx) => {
                stepRefs.current[idx] = el;
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
