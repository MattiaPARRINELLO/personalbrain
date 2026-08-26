"use client";

import { useEffect, useRef } from "react";
import { PROBLEM } from "@/app/landing-content";
import { getGsap } from "@/lib/landing/gsap";
import { useReducedMotion } from "./hooks";

/**
 * Section du problème — des fragments dispersés dans différents
 * outils se rapprochent au défilement et forment un contexte unifié.
 */
export function ProblemSection() {
  const rootRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;

    const { gsap } = getGsap();
    const ctx = gsap.context(() => {
      const fragments = gsap.utils.toArray<HTMLElement>("[data-fragment]", root);
      fragments.forEach((el, i) => {
        const fromLeft = i % 2 === 0 ? -60 : 60;
        gsap.fromTo(
          el,
          { x: fromLeft, opacity: 0.25, rotate: i % 2 === 0 ? -1.5 : 1.5 },
          {
            x: 0,
            opacity: 1,
            rotate: 0,
            ease: "power1.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              end: "top 45%",
              scrub: 0.6,
            },
          }
        );
      });
    }, root);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={rootRef} id="produit" className="problem relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="section-label">· Le problème ·</p>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-[#f5f3f0] sm:text-5xl">
            {PROBLEM.title}
          </h2>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#a5a7b3]">
            {PROBLEM.description}
          </p>
        </div>

        <ul className="problem__fragments mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
          {PROBLEM.fragments.map((fragment) => (
            <li key={fragment.text} data-fragment className="problem__fragment">
              <span className="problem__fragment-kind font-mono">{fragment.kind}</span>
              <span className="problem__fragment-text">{fragment.text}</span>
            </li>
          ))}
        </ul>

        <p className="problem__resolution mx-auto mt-12 max-w-xl text-center text-[15px] leading-relaxed text-[#c9cbd6]">
          {PROBLEM.resolution}
        </p>
      </div>
    </section>
  );
}
