"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, Timer as TimerIcon } from "lucide-react";
import { startFocusSession, stopFocusSession } from "@/app/actions/focus";
import type { FocusState } from "@/lib/focus";

const DURATIONS = [
  { min: 15, label: "15 min" },
  { min: 25, label: "25 min" },
  { min: 45, label: "45 min" },
  { min: 90, label: "90 min" },
];

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusTimer({ initialState }: { initialState: FocusState }) {
  const [state, setState] = useState<FocusState>(initialState);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endedNotified = useRef(false);

  // Session active : tick toutes les secondes pour le décompte.
  useEffect(() => {
    if (!state.active || !state.endsAt) return;
    const endsAt = new Date(state.endsAt).getTime();
    const tick = () => {
      const left = endsAt - Date.now();
      setRemaining(left);
      if (left <= 0 && !endedNotified.current) {
        endedNotified.current = true;
        // Nettoyage côté serveur une fois la session terminée.
        stopFocusSession()
          .then((next) => {
            setState(next);
            setRemaining(null);
          })
          .catch(() => {});
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state.active, state.endsAt]);

  const handleStart = async (min: number) => {
    try {
      setState(await startFocusSession(min));
      setRemaining(min * 60_000);
      endedNotified.current = false;
    } catch {
      // Session expirée ou erreur : l'UI reste sur l'état courant.
    }
  };

  const handleStop = async () => {
    try {
      setState(await stopFocusSession());
      setRemaining(null);
    } catch {
      // Ignoré.
    }
  };

  if (state.active && state.endsAt && (remaining === null || remaining > 0)) {
    const durationMs = (state.durationMin ?? 0) * 60_000;
    const progress =
      durationMs > 0 ? Math.min(1, Math.max(0, (remaining ?? 0) / durationMs)) : 0;

    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="relative w-56 h-56 rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] flex items-center justify-center mb-6">
          {/* Anneau de progression */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 224 224">
            <circle cx="112" cy="112" r="104" fill="none" stroke="var(--border-1)" strokeWidth="4" />
            <circle
              cx="112"
              cy="112"
              r="104"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 104}
              strokeDashoffset={(1 - progress) * 2 * Math.PI * 104}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <div>
            <p className="text-5xl font-black text-[var(--text-1)] font-mono tabular-nums">
              {formatRemaining(remaining ?? 0)}
            </p>
            <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-4)]">
              {state.durationMin} min
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--danger)]/30 bg-[var(--danger)]/5 text-[11px] font-mono uppercase tracking-wider text-[var(--danger)] mb-8">
          Notifications coupées
        </div>

        <button
          onClick={() => void handleStop()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-2)] text-[var(--text-2)] text-[13px] hover:border-[var(--danger)]/40 hover:text-[var(--danger)] transition-colors duration-200"
        >
          <Square className="w-4 h-4" />
          Terminer la session
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="w-24 h-24 rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] flex items-center justify-center mb-6">
        <TimerIcon className="w-9 h-9 text-[var(--text-3)]" />
      </div>
      <h2 className="text-[15px] font-semibold text-[var(--text-1)]">
        Une session de focus ?
      </h2>
      <p className="max-w-sm mt-2 text-[12.5px] text-[var(--text-3)] leading-relaxed">
        Pendant la session, les notifications de rappels et de relances sont
        coupées. Elles partiront après — rien n&apos;est perdu.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {DURATIONS.map((d) => (
          <button
            key={d.min}
            onClick={() => void handleStart(d.min)}
            className="px-4 py-2.5 rounded-xl border border-[var(--border-1)] text-[13px] text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors duration-200"
          >
            {d.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => void handleStart(25)}
        className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-[#0a0a0b] font-medium text-[13px] hover:brightness-110 active:brightness-95 transition-all duration-200"
      >
        <Play className="w-4 h-4" />
        Démarrer 25 min
      </button>
    </div>
  );
}
