import Link from "next/link";
import Image from "next/image";
import { getLeetcode, getMemory, getPhotoShoots } from "@/lib/storage";
import { Reveal } from "@/components/landing/Reveal";
import { HeroTerminal } from "@/components/landing/HeroTerminal";
import { DayTimeline } from "@/components/landing/DayTimeline";
import { ScrollStats } from "@/components/landing/ScrollStats";
import { TiltSection } from "@/components/landing/TiltSection";
import { ScrollTitle } from "@/components/landing/ScrollTitle";
import { DotGrid3D } from "@/components/landing/DotGrid3D";
import {
  KanbanMock,
  StreakMock,
  MemoryMock,
} from "@/components/landing/ModuleMocks";
import { TOOLBAR, CAPABILITIES, PRIVACY_POINTS, DAY_STEPS, STAT_LABELS } from "./landing-content";

export default async function Home() {
  const [leetcode, memory, shoots] = await Promise.all([
    getLeetcode(),
    getMemory(),
    getPhotoShoots(),
  ]);

  const STATS = [
    { value: 6, label: STAT_LABELS[0].label, suffix: STAT_LABELS[0].suffix },
    { value: leetcode.streak, label: STAT_LABELS[1].label, suffix: STAT_LABELS[1].suffix },
    { value: memory.facts.length, label: STAT_LABELS[2].label, suffix: STAT_LABELS[2].suffix },
    { value: shoots.shoots.length, label: STAT_LABELS[3].label, suffix: STAT_LABELS[3].suffix },
  ];

  return (
    <main className="min-h-screen flex flex-col overflow-x-hidden">
      <ScrollTitle />
      <DotGrid3D />
      {/* ================= Header ================= */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-1)] bg-[var(--background)]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg border border-[var(--border-2)] bg-[var(--surface-1)] flex items-center justify-center overflow-hidden">
              <Image
                src="/backstage-logo-simple.png"
                alt=""
                width={22}
                height={22}
                className="w-5 h-5 object-contain"
              />
            </div>
            <span className="text-[12px] font-black tracking-[0.25em] uppercase text-[var(--text-1)] font-mono">
              Backstage
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8" aria-label="Navigation principale">
            <a
              href="#produit"
              className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors duration-200"
            >
              Produit
            </a>
            <a
              href="#modules"
              className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors duration-200"
            >
              Modules
            </a>
            <a
              href="#vie-privee"
              className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors duration-200"
            >
              Vie privée
            </a>
          </nav>

          <Link
            href="/login"
            className="text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--text-2)] border border-[var(--border-1)] rounded-lg px-4 py-2 hover:border-[var(--border-3)] hover:text-[var(--text-1)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          >
            Connexion
          </Link>
        </div>
      </header>

      {/* ================= Hero ================= */}
      <section className="relative">
        <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 pt-20 sm:pt-28 pb-14 sm:pb-20 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] px-4 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-success)] animate-pulse-dot" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-2)]">
                Ton second cerveau, opérationnel
              </span>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-8 text-[42px] leading-[1.02] sm:text-7xl font-display font-black tracking-tight text-[var(--text-1)] text-balance">
              L'IA qui exécute.
              <br />
              <span className="gradient-text-ai">Pas un chatbot.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-[15px] sm:text-[16px] leading-relaxed text-[var(--text-2)]">
              Gmail, agenda, rappels, mémoire, recherche : BACKSTAGE branche l'IA sur
              <span className="text-[var(--text-1)]"> tes outils</span>, pas sur des promesses.
              Tu parles, il agit, et il se souvient de qui tu es.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--accent)] text-[#0a0a0b] font-medium text-[13px] hover:brightness-110 active:brightness-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
              >
                Accéder à mon espace
                <span aria-hidden>→</span>
              </Link>
              <a
                href="#produit"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-[var(--border-2)] text-[var(--text-2)] text-[13px] hover:border-[var(--border-3)] hover:text-[var(--text-1)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
              >
                Voir ce qu'il fait
              </a>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-4)]">
              <span>Espace privé</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border-3)]" aria-hidden />
              <span>Passkeys (WebAuthn)</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border-3)]" aria-hidden />
              <span>PWA</span>
            </div>
          </Reveal>
        </div>

        {/* Terminal, la signature */}
        <div className="max-w-3xl mx-auto w-full px-5 sm:px-8 pb-16 sm:pb-24">
          <Reveal delay={400}>
            <HeroTerminal />
          </Reveal>
        </div>
      </section>

      {/* ================= Bande outils ================= */}
      <section className="border-y border-[var(--border-1)] bg-[var(--surface-1)]/60">
        <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-4)]">
            Branché sur
          </span>
          {TOOLBAR.map((tool) => (
            <span
              key={tool}
              className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-3)]"
            >
              <span className="w-1 h-1 rounded-full bg-[var(--accent)]/60" aria-hidden />
              {tool}
            </span>
          ))}
        </div>
      </section>

      {/* ================= Stats réelles ================= */}
      <section>
        <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-12 sm:py-14">
          <Reveal>
            <ScrollStats stats={STATS} />
          </Reveal>
        </div>
      </section>

      {/* ================= Une journée ================= */}
      <section id="journee" className="scroll-mt-20 border-t border-[var(--border-1)]">
        <TiltSection className="max-w-4xl mx-auto w-full px-5 sm:px-8 py-20 sm:py-28">
          <Reveal>
            <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--accent)]">
              · Une journée avec BACKSTAGE ·
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl sm:text-5xl font-display font-black tracking-tight text-[var(--text-1)] text-balance">
              Défile avec moi. C'est ta journée, tenue par un seul outil.
            </h2>
            <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[var(--text-2)]">
              Du réveil au coucher, chaque moment a son geste, et BACKSTAGE tient
              la chaîne. Les interfaces ci-dessous sont celles du produit, en vrai.
            </p>
          </Reveal>

          <div className="mt-16">
            <DayTimeline steps={DAY_STEPS} />
          </div>
        </TiltSection>
      </section>

      {/* ================= Produit / Capacités ================= */}
      <section id="produit" className="scroll-mt-20">
        <TiltSection className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-20 sm:py-28">
          <Reveal>
            <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--accent)]">
              · Produit ·
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl sm:text-5xl font-display font-black tracking-tight text-[var(--text-1)] text-balance">
              Un poste de contrôle unique pour ton travail et ta vie.
            </h2>
            <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[var(--text-2)]">
              Photographe de concert, développeur, organisateur : trois métiers, une seule
              interface. La même commande, la même rigueur partout.
            </p>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border-1)] border border-[var(--border-1)] rounded-2xl overflow-hidden">
            {CAPABILITIES.map((cap, i) => (
              <Reveal key={cap.n} delay={i * 100} className="h-full">
                <div className="h-full bg-[var(--surface-1)] p-7 hover:bg-[var(--surface-2)] transition-colors duration-300">
                  <span className="text-[11px] font-mono text-[var(--text-4)]">{cap.n}</span>
                  <h3 className="mt-4 text-[16px] font-semibold text-[var(--text-1)]">
                    {cap.title}
                  </h3>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-3)]">
                    {cap.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </TiltSection>
      </section>

      {/* ================= Modules ================= */}
      <section id="modules" className="scroll-mt-20 border-t border-[var(--border-1)] bg-[var(--surface-1)]/40">
        <TiltSection className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-20 sm:py-28">
          <Reveal>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--accent)]">
                  · Modules ·
                </p>
                <h2 className="mt-4 text-3xl sm:text-4xl font-display font-black tracking-tight text-[var(--text-1)] text-balance">
                  Des outils qui ont déjà ta méthode.
                </h2>
              </div>
              <p className="max-w-sm text-[13px] leading-relaxed text-[var(--text-2)] sm:text-right">
                Chaque module respecte ta façon de travailler. La photo en 4 étapes,
                le code en série, la vie en faits.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Reveal className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-6 items-center">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--warm)]">
                    Kanban Photo
                  </p>
                  <h3 className="mt-3 text-2xl font-bold text-[var(--text-1)]">
                    Du déclencheur à la livraison, en 4 cases.
                  </h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--text-3)]">
                    Shooted → Selecting → Editing → Delivered. Chaque concert suit son
                    chemin, chaque livraison a sa date. Plus rien ne traîne dans un
                    disque dur.
                  </p>
                </div>
                <KanbanMock />
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-6 items-center h-full">
                <StreakMock />
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--accent-success)]">
                    LeetCode Companion
                  </p>
                  <h3 className="mt-3 text-2xl font-bold text-[var(--text-1)]">
                    Une série par jour. De l'aide quand ça bloque.
                  </h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--text-3)]">
                    Le streak tient la discipline, l'IA t'explique la solution
                    quand tu es coincé. Contexte de ton code, pas de réponse toute faite.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={160}>
              <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-6 items-center h-full">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--ai-thinking)]">
                    Cerveau & mémoire
                  </p>
                  <h3 className="mt-3 text-2xl font-bold text-[var(--text-1)]">
                    Il ne devine pas, il sait.
                  </h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--text-3)]">
                    Préférences, événements, relations : une mémoire éditable que l'IA
                    consulte avant de répondre. En clair, et sous ton contrôle.
                  </p>
                </div>
                <MemoryMock />
              </div>
            </Reveal>
          </div>
        </TiltSection>
      </section>

      {/* ================= Vie privée ================= */}
      <section id="vie-privee" className="scroll-mt-20">
        <TiltSection className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-20 sm:py-28">
          <Reveal>
            <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--accent)]">
              · Vie privée ·
            </p>
            <h2 className="mt-4 max-w-xl text-3xl sm:text-4xl font-display font-black tracking-tight text-[var(--text-1)] text-balance">
              Un assistant qui ne fait rien dans ton dos.
            </h2>
            <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-[var(--text-2)]">
              L'accès à tes comptes est explicite, chaque action est tracée, et la
              suppression est réelle, pas un bouton décoratif.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRIVACY_POINTS.map((point, i) => (
              <Reveal key={point.title} delay={i * 100}>
                <div className="h-full rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] p-6 hover:border-[var(--border-2)] transition-colors duration-200">
                  <div className="w-10 h-10 rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] flex items-center justify-center text-[16px]">
                    <span aria-hidden>{point.icon}</span>
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold text-[var(--text-1)]">
                    {point.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-3)]">
                    {point.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </TiltSection>
      </section>

      {/* ================= CTA final ================= */}
      <section className="border-t border-[var(--border-1)]">
        <div className="max-w-4xl mx-auto w-full px-5 sm:px-8 py-24 sm:py-32 text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-5xl font-display font-black tracking-tight text-[var(--text-1)] text-balance">
              Ton cerveau a besoin d'un backstage.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[14px] leading-relaxed text-[var(--text-2)]">
              Entre ta série de code, ta prochaine livraison et le concert de vendredi,
              un seul endroit pour tout garder en ordre.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--accent)] text-[#0a0a0b] font-medium text-[14px] hover:brightness-110 active:brightness-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
              >
                Accéder à mon espace
                <span aria-hidden>→</span>
              </Link>
            </div>
            <p className="mt-6 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-4)]">
              Authentification par clé d'accès · Sans mot de passe
            </p>
          </Reveal>
        </div>
      </section>

      {/* ================= Footer ================= */}
      <footer className="border-t border-[var(--border-1)]">
        <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image
              src="/backstage-logo-simple.png"
              alt=""
              width={18}
              height={18}
              className="w-4 h-4 object-contain"
            />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-4)]">
              Backstage · second cerveau personnel
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors duration-200"
            >
              Vie privée & données
            </Link>
            <Link
              href="/login"
              className="text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors duration-200"
            >
              Connexion
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
