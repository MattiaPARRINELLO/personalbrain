"use client";

import { useRef, useState } from "react";
import { USE_CASES } from "@/app/landing-content";

/**
 * Acte V — trois univers d'usage.
 */
export function UseCaseWorlds() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? (active + 1) % USE_CASES.cases.length
        : (active - 1 + USE_CASES.cases.length) % USE_CASES.cases.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="usages" className="worlds relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-label">· Usages ·</p>
            <h2 className="mt-4 max-w-lg text-balance font-display text-3xl font-bold tracking-tight text-[#f5f3f0] sm:text-4xl">
              {USE_CASES.title}
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Choisir un usage"
            className="worlds__tabs"
            onKeyDown={onKeyDown}
          >
            {USE_CASES.cases.map((c, i) => (
              <button
                key={c.key}
                ref={(el) => { tabRefs.current[i] = el; }}
                role="tab"
                id={`usecase-tab-${c.key}`}
                aria-selected={i === active}
                aria-controls={`usecase-panel-${c.key}`}
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                className="worlds__tab"
                data-active={i === active}
              >
                {c.tab}
              </button>
            ))}
          </div>
        </div>

        {USE_CASES.cases.map((c, i) => (
          <div
            key={c.key}
            role="tabpanel"
            id={`usecase-panel-${c.key}`}
            aria-labelledby={`usecase-tab-${c.key}`}
            hidden={i !== active}
            className="worlds__panel mt-10"
          >
            <div className="worlds__card">
              <p className="worlds__mission font-display text-xl font-semibold text-[#f5f3f0] sm:text-2xl">
                « {c.query} »
              </p>

              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.2fr]">
                {/* Fragments mobilisés */}
                <div>
                  <p className="worlds__deliverables-label font-mono">Fragments reliés</p>
                  <ul className="mt-3 space-y-2">
                    {c.fragments.map((f) => (
                      <li key={f.text} className="worlds__fragment">
                        <span className="worlds__fragment-kind font-mono">{f.kind}</span>
                        <span className="worlds__fragment-text">{f.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Réponse */}
                <div className="worlds__answer">
                  <p className="worlds__answer-label font-mono">Réponse contextualisée</p>
                  <p className="worlds__answer-text mt-3">{c.answer}</p>
                </div>
              </div>

              <p className="worlds__note mt-6 font-mono">{c.note}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
