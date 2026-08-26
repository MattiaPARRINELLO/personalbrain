"use client";

import Link from "next/link";
import { FINAL_CTA } from "@/app/landing-content";
import { scrollToSection } from "./SmoothScroll";

export function FinalCTA() {
  return (
    <section className="final relative flex min-h-[80svh] flex-col items-center justify-center px-5 py-28 text-center sm:px-8">
      <h2 className="final__title max-w-3xl font-display text-3xl font-bold tracking-tight text-[#f5f3f0] sm:text-5xl">
        {FINAL_CTA.title}
      </h2>
      <p className="final__desc mx-auto mt-5 max-w-xl">{FINAL_CTA.description}</p>

      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={() => scrollToSection("demo")} className="cta-primary">
          {FINAL_CTA.primaryCta}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Link href="/login" className="cta-secondary cta-secondary--solid">
          {FINAL_CTA.secondaryCta}
        </Link>
        <a
          href="https://github.com/MattiaPARRINELLO/personalbrain"
          target="_blank"
          rel="noopener noreferrer"
          className="final__tertiary font-mono"
        >
          {FINAL_CTA.tertiaryCta}
        </a>
      </div>

      <p className="final__reassurance mt-8 font-mono">{FINAL_CTA.note}</p>
    </section>
  );
}
