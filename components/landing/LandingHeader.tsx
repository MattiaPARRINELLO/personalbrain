"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { NAV_LINKS } from "@/app/landing-content";
import { scrollToSection } from "./SmoothScroll";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        data-scrolled={scrolled}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-white/[0.06] bg-[#050507]/70 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between px-5 transition-all duration-300 sm:px-8 ${
            scrolled ? "h-14" : "h-18"
          }`}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]"
            aria-label="Backstage — accueil"
          >
            <Image
              src="/backstage-logo-simple.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
            <span className="font-mono text-[12px] font-bold uppercase tracking-[0.28em] text-[#f5f3f0]">
              Backstage
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigation principale">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => scrollToSection(link.href.slice(1))}
                className="rounded px-1 py-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#a5a7b3] transition-colors duration-200 hover:text-[#f5f3f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => scrollToSection("demo")}
              className="hidden rounded-full border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#e9e4ff] transition-all duration-200 hover:border-[#a78bfa]/70 hover:bg-[#a78bfa]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa] sm:inline-flex"
            >
              Essayer la démo
            </button>
            <Link
              href="/login"
              className="hidden rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#a5a7b3] transition-colors hover:text-[#f5f3f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa] sm:inline-flex"
            >
              Se connecter
            </Link>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#a5a7b3] transition-colors hover:text-[#f5f3f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa] lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="menu-mobile"
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                {menuOpen ? (
                  <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                ) : (
                  <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="menu-mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-4 top-20 z-40 rounded-2xl border border-white/[0.08] bg-[#0a0a12]/95 p-4 backdrop-blur-xl lg:hidden"
          >
            <nav aria-label="Navigation mobile" className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToSection(link.href.slice(1));
                  }}
                  className="rounded-lg px-3 py-3 text-left font-mono text-[12px] uppercase tracking-[0.16em] text-[#a5a7b3] transition-colors hover:bg-white/[0.04] hover:text-[#f5f3f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]"
                >
                  {link.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  scrollToSection("demo");
                }}
                className="mt-3 rounded-xl bg-[#a78bfa] px-5 py-3 text-center font-medium text-[#0a0a12] transition-colors hover:bg-[#b9a5ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5f3f0]"
              >
                Essayer la démo
              </button>
              <Link
                href="/login"
                className="mt-2.5 rounded-xl border border-white/10 px-5 py-3 text-center font-mono text-[12px] uppercase tracking-[0.14em] text-[#f5f3f0] transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]"
              >
                Se connecter
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
