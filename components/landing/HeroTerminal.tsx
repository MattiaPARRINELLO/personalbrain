"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Step =
  | { kind: "user"; text: string }
  | { kind: "tool"; label: string; detail: string }
  | { kind: "assistant"; text: string };

const SCRIPT: Step[] = [
  { kind: "user", text: "Qui a joué au Zénith vendredi dernier, et mon agenda de la semaine ?" },
  { kind: "tool", label: "gmail.search", detail: 'from:"zenith.fr" after:2026/07/31 · 3 résultats' },
  { kind: "tool", label: "calendar.read", detail: "Semaine du 03/08 → 4 shoots, 2 retours client" },
  { kind: "assistant", text: "Vendredi : **M83** au Zénith, set complet à 22h. Tu as shooté 214 photos, 12 sont encore en sélection. Ton prochain rendu client est mercredi 12h." },
  { kind: "tool", label: "brain.remember", detail: "« M83 → shoot Zénith 31/07 » mémorisé (confiance 96%)" },
];

const FINAL_USER = "Et je peux avoir un rappel pour livrer les photos de M83 ?";
const FINAL_TOOL = { kind: "tool" as const, label: "reminder.create", detail: "Mer. 12/08 11:00 · « Livrer sélection M83 » (push + email)" };
const FINAL_AI = "C'est noté. Je te préviens mercredi matin, et si les photos sont prêtes avant, dis-le-moi, j'annule le rappel.";

/* ---- Réponses scriptées pour la démo interactive ---- */

const SUGGESTIONS = ["Qui a joué au Zénith ?", "Rappelle-moi de livrer M83", "Ma série LeetCode ?", "aide"];

type ScriptedReply = {
  tool?: { label: string; detail: string };
  ai: string;
};

function replyTo(input: string): ScriptedReply {
  const q = input.toLowerCase();
  if (q.includes("sudo"))
    return { ai: "Tu as déjà les droits root sur ta propre vie. C'est tout le principe." };
  if (q.includes("backstage"))
    return { ai: "Backstage, c'est le coulisse de ton cerveau : la mémoire, les outils et les rappels qui travaillent pendant que tu joues." };
  if (q.includes("aide") || q.includes("help") || q === "?" || q === "help")
    return {
      tool: { label: "backstage.help", detail: "4 commandes : 'zénith' · 'rappel' · 'série' · 'sudo'" },
      ai: "Essaie « Qui a joué au Zénith ? », « Rappelle-moi de livrer M83 » ou « Ma série LeetCode ? ». Et si tu te sens audacieux, tape « sudo ».",
    };
  if (q.includes("zénith") || q.includes("zenith") || q.includes("m83") || q.includes("concert"))
    return {
      tool: { label: "gmail.search", detail: 'from:"zenith.fr" after:2026/07/31 · 3 résultats' },
      ai: "Vendredi : **M83** au Zénith, set complet à 22h. Tu as shooté 214 photos, 12 sont encore en sélection. Ton prochain rendu client est mercredi 12h.",
    };
  if (q.includes("rappel") || q.includes("rappelle") || q.includes("reminder") || q.includes("livrer"))
    return {
      tool: { label: "reminder.create", detail: "Mer. 12/08 11:00 · « Livrer sélection M83 » (push + email)" },
      ai: "C'est noté. Je te préviens mercredi matin, et si les photos sont prêtes avant, dis-le-moi, j'annule le rappel.",
    };
  if (q.includes("série") || q.includes("serie") || q.includes("leetcode") || q.includes("streak"))
    return {
      tool: { label: "leetcode.streak", detail: "47 jours · série maintenue" },
      ai: "Ta série tient : **47 jours**. Le problème d'aujourd'hui attend, et si tu bloques, je te montre le pattern, pas la solution.",
    };
  if (q.includes("photo") || q.includes("shoot") || q.includes("kanban") || q.includes("livraison"))
    return {
      tool: { label: "kanban.read", detail: "Shooted 6 · Selecting 4 · Editing 3 · Delivered 12" },
      ai: "25 shoots suivis. **M83 est en sélection** (214 photos), livraison mercredi 12h. Rien ne traîne dans un disque dur.",
    };
  if (q.includes("bonjour") || q.includes("salut") || q.includes("hello") || q.includes("couco"))
    return {
      ai: "Salut. Je suis branché sur ton Gmail, ton agenda, tes rappels et ta mémoire. Pose une vraie question, par exemple sur un concert.",
    };
  return {
    tool: { label: "brain.search", detail: "0 correspondance directe · suggestions" },
    ai: "Je n'ai pas de réponse exacte à ça en démo. Essaie « Qui a joué au Zénith ? », « Rappelle-moi de livrer M83 », « Ma série LeetCode ? » ou « aide ».",
  };
}

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
  const [turns, setTurns] = useState<{ user: string; reply: ScriptedReply }[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const interactive = showFinalAi;

  const submit = () => {
    const q = input.trim();
    if (!q) return;
    setTurns((t) => [...t, { user: q, reply: replyTo(q) }]);
    setInput("");
  };

  // Garde le dernier message visible quand la conversation s'allonge
  useEffect(() => {
    if (turns.length > 0 && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [turns]);

  // Focus le vrai input quand la démo se termine
  useEffect(() => {
    if (interactive && inputRef.current) inputRef.current.focus();
  }, [interactive]);

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
          backstage · session privée
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-[var(--accent-success)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-success)] animate-pulse-dot" />
          outils actifs
        </span>
      </div>

      {/* Transcript */}
      <div
        ref={transcriptRef}
        className="px-4 sm:px-5 py-4 sm:py-5 flex flex-col gap-3.5 min-h-[320px] sm:min-h-[340px] max-h-[460px] overflow-y-auto"
      >
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
        {turns.map((t, i) => (
          <div key={`t${i}`} className="flex flex-col gap-3.5 fade-in-up">
            <div className="flex items-start gap-3 pl-1">
              <span className="shrink-0 w-2 h-2 mt-[7px] rounded-full bg-[var(--warm)]" />
              <p className="text-[12px] sm:text-[12.5px] leading-relaxed text-[var(--text-1)]">
                {t.user}
              </p>
            </div>
            {t.reply.tool && (
              <div className="flex items-start gap-3 pl-1">
                <span className="shrink-0 w-2 h-2 mt-[7px] rounded-full bg-[var(--accent-cool)]" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--accent-cool)]">
                    ⚡ {t.reply.tool.label}
                  </span>
                  <span className="text-[11.5px] font-mono text-[var(--text-3)]">{t.reply.tool.detail}</span>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 pl-1">
              <span className="shrink-0 w-2 h-2 mt-[7px] rounded-full bg-[var(--accent)]" />
              <p className="text-[12px] sm:text-[12.5px] leading-relaxed text-[var(--text-2)]">
                {t.reply.ai.split("**").map((part, j) =>
                  j % 2 === 1 ? (
                    <span key={j} className="text-[var(--text-1)] font-medium">{part}</span>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input interactif : réel une fois la démo terminée */}
      <div className="px-4 sm:px-5 py-3 border-t border-[var(--border-1)] bg-[var(--surface-2)]/60">
        {interactive ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <span className="text-[11px] font-mono text-[var(--text-4)]">toi</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pose une question…"
              autoComplete="off"
              aria-label="Essayer une question dans la démo"
              className="flex-1 h-6 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-2.5 text-[11px] font-mono text-[var(--text-1)] placeholder:text-[var(--text-4)] focus:outline-none focus:border-[var(--accent)]/60 transition-colors"
            />
            <button
              type="submit"
              className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--accent)] hover:text-[var(--accent-soft)] transition-colors shrink-0"
            >
              envoyer ↵
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[var(--text-4)]">toi</span>
            <div className="flex-1 h-6 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] flex items-center px-2.5">
              <span className="text-[11px] font-mono text-[var(--text-3)]">{">"}</span>
              <span className="ml-1.5 text-[11px] font-mono text-[var(--text-4)]">
                {showFinalAi ? "Pose une question…" : "…"}
              </span>
            </div>
          </div>
        )}
        {interactive && turns.length === 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setTurns((t) => [...t, { user: s, reply: replyTo(s) }]);
                }}
                className="rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[9.5px] font-mono text-[var(--text-3)] hover:text-[var(--text-1)] hover:border-[var(--border-3)] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
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
