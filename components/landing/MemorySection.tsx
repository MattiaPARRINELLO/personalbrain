"use client";

import { MEMORY } from "@/app/landing-content";

/**
 * Section mémoire — se souvenir, relier, garder le contrôle.
 * Les trois principes correspondent aux capacités réelles du
 * produit (faits mémorisés listés, éditables, supprimables).
 */
export function MemorySection() {
  return (
    <section id="memoire" className="memory relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="section-label">· Mémoire ·</p>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-[#f5f3f0] sm:text-5xl">
            {MEMORY.title}
          </h2>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#a5a7b3]">
            {MEMORY.description}
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] md:grid-cols-3">
          {MEMORY.principles.map((principle) => (
            <article key={principle.n} className="memory__card">
              <span className="memory__card-n font-mono">{principle.n}</span>
              <h3 className="memory__card-title">{principle.title}</h3>
              <p className="memory__card-desc">{principle.desc}</p>
            </article>
          ))}
        </div>

        {/* Aperçu mémoire — interface fictive illustrative */}
        <div className="memory__preview mx-auto mt-12 max-w-2xl" aria-hidden="true">
          <div className="memory__preview-bar">
            <span className="memory__preview-dot" />
            <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#6b6d7c]">
              Mémoire — aperçu illustratif
            </span>
          </div>
          <ul className="memory__preview-list">
            {[
              { cat: "Contact", text: "Claire V. — attachée de presse, contact accréditations" },
              { cat: "Préférence", text: "Objectif lumineux privilégié en fosse" },
              { cat: "Projet", text: "Série « Scène 2025 » — livraison en cours" },
            ].map((fact) => (
              <li key={fact.text} className="memory__fact">
                <span className="memory__fact-cat font-mono">{fact.cat}</span>
                <span className="memory__fact-text">{fact.text}</span>
                <span className="memory__fact-actions font-mono" title="Chaque fait est éditable ou supprimable">
                  éditer · supprimer
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
