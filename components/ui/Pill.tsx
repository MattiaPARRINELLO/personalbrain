"use client";

import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "warm" | "success" | "danger" | "muted";

const toneClasses: Record<Tone, string> = {
  neutral: "border-[var(--border-2)] text-[var(--text-2)] bg-[var(--surface-2)]",
  accent: "border-[var(--accent)]/30 text-[var(--accent)] bg-[var(--accent)]/8",
  warm: "border-[var(--warm)]/30 text-[var(--warm)] bg-[var(--warm)]/8",
  success: "border-[var(--success)]/30 text-[var(--success)] bg-[var(--success)]/8",
  danger: "border-[var(--danger)]/30 text-[var(--danger)] bg-[var(--danger)]/8",
  muted: "border-[var(--border-1)] text-[var(--text-3)] bg-[var(--surface-1)]",
};

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  dot?: boolean;
};

export function Pill({ className, tone = "neutral", dot, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] font-mono whitespace-nowrap",
        toneClasses[tone],
        className
      )}
      {...rest}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            tone === "accent" && "bg-[var(--accent)]",
            tone === "warm" && "bg-[var(--warm)]",
            tone === "success" && "bg-[var(--success)]",
            tone === "danger" && "bg-[var(--danger)]",
            tone === "muted" && "bg-[var(--text-4)]",
            tone === "neutral" && "bg-[var(--text-3)]"
          )}
        />
      )}
      {children}
    </span>
  );
}
