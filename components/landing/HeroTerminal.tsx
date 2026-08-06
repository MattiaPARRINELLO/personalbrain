"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Step =
  | { kind: "user"; text: string }
  | { kind: "tool"; label: string; detail: string }
  | { kind: "assistant"; text: string };

const SCRIPT: Step[] = [
  { kind: "user", text: "Qui a joué au Zénith vendredi dernier, et mon agenda de la semaine ?" },
  { kind: "tool", label: "gmail.search", detail: 'from:"zenith.fr" after:2026/07/31 — 3 résultats' },
  { kind: "tool", label: "calendar.read", detail: "Semaine du 03/08 → 4 shoots, 2 retours client" },
  { kind: "assistant", text: "Vendredi : **M83** au Zénith, set complet à 22h. Tu as shooté 214 photos — 12 sont encore en sélection. Ton prochain rendu client est mercredi 12h." },
  { kind: "tool", label: "brain.remember", detail: "« M83 → shoot Zénith 31/07 » mémorisé (confiance 96%)" },
];

const FINAL_USER = "Et je peux avoir un rappel pour livrer les photos de M83 ?";
const FINAL_TOOL = { kind: "tool" as const, label: "reminder.create", detail: "Mer. 12/08 11:00 — « Livrer sélection M83 » (push + email)" };
const FINAL_AI = "C'est noté. Je te préviens mercredi matin, et si les photos sont prêtes avant, dis-le-moi — j'annule le rappel.";

function StepView({ step }: { step: Step }) {
  if (step.kind === "user") {
    return (
      <div className="flex items-start gap-3 pl-1">
        <span className="shrink-0 w-2 h-2 mt-[7px] rounded-full bg-[var(--warm)]" />
        <p className="text-[12px] sm:text-[12.5px] leading-relaxed text-[var(--text-1)]">
          {step.text}
        </p>
      </div>
    );
  }
  if (step.kind === "tool") {
    return (
      <div className="flex items-start gap-3 pl-1">
        <span className="shrink-0 w-2 h-2 mt-[7px] rounded-full bg-[var(--accent-cool)]" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--accent-cool)]">
            ⚡ {step.label}
          </span>
          <span className="text-[11.5px] font-mono text-[var(--text-3)]">{step.detail}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 pl-1">
      <span className="shrink-0 w-2 h-2 mt-[7px] rounded-full bg-[var(--accent)]" />
      <div className="text-[12px] sm:text-[12.5px] leading-relaxed text-[var(--text-2)]">
        {step.text.split("**").map((part, i) =>
          i % 2 === 1 ? (
            <span key={i} className="text-[var(--text-1)] font-medium">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>
    </div>
  );
}

function useTypewriter(text: string, active: boolean, speed = 14) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (shown >= text.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), speed);
    return () => clearTimeout(t);
  }, [active, shown, text, speed]);
  return text.slice(0, shown);
}

export function HeroTerminal() {
  const [phase, setPhase] = useState(0);
  const [showFinalUser, setShowFinalUser] = useState(false);
  const [showFinalTool, setShowFinalTool] = useState(false);
  const [showFinalAi, setShowFinalAi] = useState(false);

  // SCRIPT phases: each index renders 0..phase steps fully, phase i-th is typing
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => {
        setPhase(SCRIPT.length);
        setShowFinalUser(true);
        setShowFinalTool(true);
        setShowFinalAi(true);
      });
      return () => cancelAnimationFrame(raf);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const scriptTotal = SCRIPT.reduce((acc, s) => {
      const len = s.kind === "tool" ? s.detail.length : s.text.length;
      return acc + len * 14 + 900;
    }, 0);
    timers.push(setTimeout(() => setPhase(1), 600));
    timers.push(setTimeout(() => setPhase(2), 600 + scriptTotal));
    timers.push(
      setTimeout(
        () => setShowFinalUser(true),
        600 + scriptTotal + 800
      )
    );
    timers.push(
      setTimeout(
        () => setShowFinalTool(true),
        600 + scriptTotal + 800 + FINAL_USER.length * 14 + 900
      )
    );
    timers.push(
      setTimeout(
        () => setShowFinalAi(true),
        600 + scriptTotal + 800 + FINAL_USER.length * 14 + 900 + 700
      )
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const userTypedText = useTypewriter(FINAL_USER, showFinalUser);
  const finalAiText = useTypewriter(FINAL_AI, showFinalAi);

  const pulseEnd =
    showFinalAi && finalAiText.length < FINAL_AI.length ? (
      <span className="inline-block w-[7px] h-[13px] ml-0.5 align-[-2px] bg-[var(--accent)] animate-blink-cursor" />
    ) : null;

  return (
    <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-1)] bg-[var(--surface-2)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#f87171]/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#4ade80]/70" />
        <span className="ml-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-4)]">
          backstage — session privée
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-[var(--accent-success)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-success)] animate-pulse-dot" />
          outils actifs
        </span>
      </div>

      {/* Transcript */}
      <div className="px-4 sm:px-5 py-4 sm:py-5 flex flex-col gap-3.5 min-h-[320px] sm:min-h-[340px]">
        {SCRIPT.slice(0, phase).map((s, i) => (
          <div key={`s${i}`} className="fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
            <StepView step={s} />
          </div>
        ))}
        {showFinalUser && (
          <div className="flex items-start gap-3 pl-1">
            <span className="shrink-0 w-2 h-2 mt-[7px] rounded-full bg-[var(--warm)]" />
            <p className="text-[12px] sm:text-[12.5px] leading-relaxed text-[var(--text-1)]">
              {userTypedText}
              {showFinalUser && userTypedText.length < FINAL_USER.length ? (
                <span className="inline-block w-[7px] h-[13px] ml-0.5 align-[-2px] bg-[var(--warm)] animate-blink-cursor" />
              ) : null}
            </p>
          </div>
        )}
        {showFinalTool && (
          <div className="flex items-start gap-3 pl-1">
            <span className="shrink-0 w-2 h-2 mt-[7px] rounded-full bg-[var(--accent-cool)]" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--accent-cool)]">
                ⚡ {FINAL_TOOL.label}
              </span>
              <span className="text-[11.5px] font-mono text-[var(--text-3)]">{FINAL_TOOL.detail}</span>
            </div>
          </div>
        )}
        {showFinalAi && (
          <div className="flex items-start gap-3 pl-1">
            <span className="shrink-0 w-2 h-2 mt-[7px] rounded-full bg-[var(--accent)]" />
            <p className="text-[12px] sm:text-[12.5px] leading-relaxed text-[var(--text-2)]">
              {finalAiText}
              {pulseEnd}
            </p>
          </div>
        )}
      </div>

      {/* Input mock */}
      <div className="px-4 sm:px-5 py-3 border-t border-[var(--border-1)] bg-[var(--surface-2)]/60">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[var(--text-4)]">toi</span>
          <div className="flex-1 h-6 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] flex items-center px-2.5">
            <span className="text-[11px] font-mono text-[var(--text-3)]">{">"}</span>
            <span className="ml-1.5 text-[11px] font-mono text-[var(--text-4)]">
              {showFinalAi ? "Écris un message…" : "…"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MiniTerminalLine({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-4)]", className)}>
      <span className="text-[var(--accent)]">$</span>
      <span>backstage --run</span>
    </div>
  );
}
