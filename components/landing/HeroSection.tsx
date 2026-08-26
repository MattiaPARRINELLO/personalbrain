"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { HERO } from "@/app/landing-content";
import { scrollToSection } from "./SmoothScroll";

const LAYERS = [
  { kind: "Conversation", text: "« Objectif lumineux pour la fosse »", x: -215, y: -78, delay: 0 },
  { kind: "Événement", text: "Shooting — jeudi 20:30", x: 205, y: -64, delay: 120 },
  { kind: "Mémoire", text: "Claire V. — attachée de presse", x: -195, y: 74, delay: 240 },
  { kind: "Information", text: "Accréditation à retirer sur place", x: 200, y: 88, delay: 360 },
] as const;

/**
 * Hero — les éléments dispersés se rapprochent et se connectent
 * autour d'un même contexte (perspective CSS + parallaxe pointeur).
 */
export function HeroSection() {
  const stackRef = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const handlePointer = useCallback((e: React.PointerEvent) => {
    if (reducedRef.current || !stackRef.current) return;
    const rect = stackRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    stackRef.current.style.setProperty("--tilt-x", `${(-py * 5).toFixed(2)}deg`);
    stackRef.current.style.setProperty("--tilt-y", `${(px * 7).toFixed(2)}deg`);
  }, []);

  const resetPointer = useCallback(() => {
    stackRef.current?.style.setProperty("--tilt-x", "0deg");
    stackRef.current?.style.setProperty("--tilt-y", "0deg");
  }, []);

  return (
    <section
      id="hero"
      className="relative flex min-h-svh flex-col items-center justify-center px-5 pb-20 pt-28 text-center sm:px-8"
    >
      <p className="hero__eyebrow">
        <span className="hero__eyebrow-dot" aria-hidden />
        {HERO.eyebrow}
      </p>

      <h1 className="hero__title mt-7 max-w-3xl text-balance">
        {(() => {
          const words = HERO.title.split(" ");
          const last = words.pop() ?? "";
          return (
            <>
              {words.join(" ")}
              {words.length > 0 ? " " : ""}
              <span className="hero__title-grad">{last}</span>
            </>
          );
        })()}
      </h1>

      <p className="hero__desc mt-6 max-w-2xl text-balance">{HERO.description}</p>

      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={() => scrollToSection("demo")} className="cta-primary">
          {HERO.primaryCta}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("produit")}
          className="cta-secondary"
        >
          {HERO.secondaryCta}
        </button>
      </div>

      <p className="mt-5 text-[12px] text-[#6b6d7a]">
        <Link
          href="/login"
          className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-[#a5a7b3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa] rounded"
        >
          {HERO.loginCta}
        </Link>
        {" · "}
        {HERO.note}
      </p>

      {/* Couches d'interface — fragments convergents */}
      <div
        ref={stackRef}
        onPointerMove={handlePointer}
        onPointerLeave={resetPointer}
        className="hero__stack"
        aria-hidden="true"
      >
        <div className="hero__stack-core">
          <span className="hero__core-label font-mono">Contexte</span>
          <span className="hero__core-dot" />
          {LAYERS.map((layer) => (
            <div
              key={layer.kind}
              className="hero__layer"
              style={{ ["--layer-x" as string]: `${layer.x}px`, ["--layer-y" as string]: `${layer.y}px`, ["--layer-delay" as string]: `${layer.delay}ms` }}
            >
              <span className="hero__layer-kind font-mono">{layer.kind}</span>
              <span className="hero__layer-text">{layer.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
