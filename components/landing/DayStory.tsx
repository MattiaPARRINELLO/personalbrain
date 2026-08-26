"use client";

import { useEffect, useRef, useState } from "react";
import { DAY_STORY } from "@/app/landing-content";
import { getGsap } from "@/lib/landing/gsap";
import { useReducedMotion } from "./hooks";

const BEATS = DAY_STORY.beats;

type Outcome = "confirm" | "dismiss";

/**
 * Scrollytelling « Une journée avec Backstage ».
 * Le temps AVANCE à chaque étape (08:42 → lendemain 09:30) : on suit
 * une personne fictive dont le contexte se constitue et se relie au
 * fil de la journée. Données fictives, signalées comme telles.
 */
export function DayStory() {
  const rootRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const lastStep = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;

    const { gsap } = getGsap();
    const ctx = gsap.context(() => {
      gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: `+=${(BEATS.length + 0.5) * window.innerHeight}`,
          scrub: 0.6,
          pin: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            const idx = Math.min(
              BEATS.length - 1,
              Math.floor(self.progress * BEATS.length)
            );
            if (idx !== lastStep.current) {
              lastStep.current = idx;
              setStep(idx);
            }
          },
        },
      });
    }, root);

    return () => ctx.revert();
  }, [reduced]);

  const beat = BEATS[step];

  // ----- Version statique (reduced motion) : toutes les étapes -----
  if (reduced) {
    return (
      <section className="daystory daystory--static relative py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <p className="section-label">· Une journée avec Backstage ·</p>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#f5f3f0] sm:text-4xl">
            Même contexte, du matin à la sélection.
          </h2>
          <p className="mt-4 text-[14px] text-[#a5a7b3]">{DAY_STORY.disclaimer}</p>

          <ol className="mt-12 space-y-10">
            {BEATS.map((b) => (
              <li key={b.time} className="daystory__static-beat">
                <div className="flex items-baseline gap-3">
                  <span className="daystory__time">{b.time}</span>
                  <span className="daystory__when font-mono">{b.when}</span>
                </div>
                <p className="daystory__query mt-3">« {b.query} »</p>
                <ul className="daystory__connections mt-4">
                  {b.connections.map((c) => (
                    <li key={c.text} className="daystory__connection" data-ready="true">
                      <span className="daystory__connection-kind">{c.kind}</span>
                      <span className="daystory__connection-text">{c.text}</span>
                    </li>
                  ))}
                </ul>
                <p className="daystory__answer-text mt-4">{b.answer}</p>
              </li>
            ))}
          </ol>
          <p className="mt-12 border-t border-white/[0.06] pt-6 text-[14px] text-[#c9cbd6]">
            {DAY_STORY.outro}
          </p>
        </div>
      </section>
    );
  }

  const outcome = outcomes[step];
  const setOutcome = (o: Outcome) =>
    setOutcomes((prev) => ({ ...prev, [step]: o }));

  return (
    <section ref={rootRef} className="daystory relative flex items-center overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 sm:px-8 lg:grid-cols-[200px_1fr]">
        {/* Frise chronologique */}
        <ol className="daystory__rail" aria-hidden="true">
          {BEATS.map((b, i) => (
            <li
              key={b.time}
              className="daystory__rail-item"
              data-active={i === step}
              data-past={i < step}
            >
              <span className="daystory__rail-dot" />
              <span className="daystory__rail-time font-mono">{b.time}</span>
              <span className="daystory__rail-when">{b.when}</span>
            </li>
          ))}
        </ol>

        {/* Étape active */}
        <div className="daystory__beat" key={step}>
          <p className="section-label">· Une journée avec Backstage ·</p>
          <div className="daystory__time-row mt-3">
            <p className="daystory__time">{beat.time}</p>
            <p className="daystory__when font-mono">{beat.when}</p>
          </div>
          <h2 className="daystory__query mt-4 text-balance font-display text-2xl font-bold leading-snug tracking-tight text-[#f5f3f0] sm:text-3xl">
            « {beat.query} »
          </h2>

          <div className="daystory__panel mt-8">
            <p className="daystory__panel-label font-mono">
              Contexte mobilisé · étape {step + 1}/{BEATS.length}
            </p>
            <ul className="daystory__connections mt-4">
              {beat.connections.map((connection, i) => (
                <li
                  key={connection.text}
                  className="daystory__connection"
                  data-ready="true"
                  style={{ ["--conn-i" as string]: i }}
                >
                  <span className="daystory__connection-kind font-mono">{connection.kind}</span>
                  <span className="daystory__connection-text">{connection.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="daystory__answer mt-7">
            <p className="daystory__answer-label font-mono">Réponse contextualisée</p>
            <p className="daystory__answer-text mt-3">{beat.answer}</p>
          </div>

          <div className="daystory__next mt-6">
            <p className="daystory__next-label font-mono">{beat.nextStep.label}</p>
            <p className="mt-2 text-[14px] text-[#c9cbd6]">{beat.nextStep.text}</p>
            {outcome === undefined ? (
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button type="button" onClick={() => setOutcome("confirm")} className="daystory__confirm">
                  {beat.nextStep.confirm}
                </button>
                <button type="button" onClick={() => setOutcome("dismiss")} className="daystory__dismiss">
                  {beat.nextStep.dismiss}
                </button>
              </div>
            ) : (
              <p className="daystory__outcome mt-4" aria-live="polite">
                {outcome === "confirm" ? beat.nextStep.confirmed : beat.nextStep.dismissed}
              </p>
            )}
          </div>

          {step === BEATS.length - 1 && (
            <p className="daystory__outro mt-8 border-t border-white/[0.06] pt-6 text-[14px] leading-relaxed text-[#c9cbd6]">
              {DAY_STORY.outro}
            </p>
          )}
        </div>
      </div>

      {/* Filet de progression bas */}
      <div className="daystory__progress" aria-hidden="true">
        <span className="daystory__progress-bar" style={{ width: `${((step + 1) / BEATS.length) * 100}%` }} />
      </div>
    </section>
  );
}
