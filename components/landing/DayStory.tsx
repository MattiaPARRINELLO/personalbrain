"use client";

import { useEffect, useRef, useState } from "react";
import { DAY_STORY } from "@/app/landing-content";
import { getGsap } from "@/lib/landing/gsap";
import { useReducedMotion } from "./hooks";

/**
 * Scrollytelling — une journée contextualisée.
 * Séquence épinglée : demande → connexions du contexte → réponse
 * synthétisée → action suggérée (jamais exécutée sans accord).
 * Données fictives, signalées comme telles.
 */
export function DayStory() {
  const rootRef = useRef<HTMLElement>(null);
  const [connectionsReady, setConnectionsReady] = useState(false);
  const [answerReady, setAnswerReady] = useState(false);
  const [choice, setChoice] = useState<null | "confirm" | "dismiss">(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (reduced) {
      // Statique : tout est visible, rien n'est épinglé.
      const raf = requestAnimationFrame(() => {
        setConnectionsReady(true);
        setAnswerReady(true);
      });
      return () => cancelAnimationFrame(raf);
    }

    const { gsap } = getGsap();
    const ctx = gsap.context(() => {
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: isMobile ? "+=200%" : "+=280%",
          scrub: 0.6,
          pin: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            setConnectionsReady(self.progress > 0.18);
            setAnswerReady(self.progress > 0.62);
          },
        },
      });
    }, root);

    return () => ctx.revert();
  }, [reduced]);

  const showConnections = reduced || connectionsReady;
  const showAnswer = reduced || answerReady;

  return (
    <section ref={rootRef} className="daystory relative flex items-center overflow-hidden">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Colonne récit */}
          <div>
            <p className="section-label">· Une journée avec Backstage ·</p>
            <p className="daystory__time font-display">08:42</p>
            <h2 className="daystory__query mt-4 text-balance font-display text-2xl font-bold leading-snug tracking-tight text-[#f5f3f0] sm:text-3xl">
              « {DAY_STORY.query} »
            </h2>
            <p className="daystory__disclaimer mt-5 font-mono">{DAY_STORY.disclaimer}</p>

            {showAnswer && (
              <div className="daystory__answer mt-8">
                <p className="daystory__answer-label font-mono">Réponse contextualisée</p>
                <p className="daystory__answer-text mt-3">{DAY_STORY.answer}</p>
              </div>
            )}

            {showAnswer && (
              <div className="daystory__next mt-6">
                <p className="daystory__next-label font-mono">{DAY_STORY.nextStep.label}</p>
                <p className="mt-2 text-[14px] text-[#c9cbd6]">{DAY_STORY.nextStep.text}</p>
                {choice === null ? (
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => setChoice("confirm")}
                      className="daystory__confirm"
                    >
                      {DAY_STORY.nextStep.confirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChoice("dismiss")}
                      className="daystory__dismiss"
                    >
                      {DAY_STORY.nextStep.dismiss}
                    </button>
                  </div>
                ) : (
                  <p className="daystory__outcome mt-4" aria-live="polite">
                    {choice === "confirm"
                      ? DAY_STORY.nextStep.confirmed
                      : DAY_STORY.nextStep.dismissed}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Colonne connexions */}
          <div className="daystory__panel" data-ready={showConnections}>
            <p className="daystory__panel-label font-mono">
              {showConnections ? "Contexte relié" : "Recherche dans vos éléments…"}
            </p>
            <ul className="daystory__connections mt-5">
              {DAY_STORY.connections.map((connection, i) => (
                <li
                  key={connection.text}
                  className="daystory__connection"
                  data-ready={showConnections}
                  style={{ ["--conn-i" as string]: i }}
                >
                  <span className="daystory__connection-kind font-mono">{connection.kind}</span>
                  <span className="daystory__connection-text">{connection.text}</span>
                </li>
              ))}
            </ul>
            {showAnswer && (
              <div className="daystory__link-line" aria-hidden />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
