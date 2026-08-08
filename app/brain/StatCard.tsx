"use client";

import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof BarChart3;
  tone: "accent" | "warm" | "success" | "muted";
}) {
  const toneClass =
    tone === "accent"
      ? "text-[var(--accent-soft)] bg-[var(--accent)]/10 border-[var(--accent)]/20"
      : tone === "warm"
        ? "text-[var(--warm)] bg-[var(--warm)]/10 border-[var(--warm)]/20"
        : tone === "success"
          ? "text-[var(--accent-success)] bg-[var(--accent-success)]/10 border-[var(--accent-success)]/20"
          : "text-[var(--text-2)] bg-[var(--surface-2)]/60 border-[var(--border-2)]";
  return (
    <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 p-3.5 flex items-center gap-3 hover:border-[var(--border-2)] transition-colors">
      <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", toneClass)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-3)] font-mono">
          {label}
        </p>
        <p className="text-[18px] font-semibold text-[var(--text-1)] leading-tight tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}
