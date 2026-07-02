"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "warm" | "success" | "danger" | "muted";

const toneClasses: Record<Tone, string> = {
  neutral: "text-[var(--text-2)] bg-[var(--surface-2)]",
  accent: "text-[var(--accent)] bg-[var(--accent)]/10",
  warm: "text-[var(--warm)] bg-[var(--warm)]/10",
  success: "text-[var(--success)] bg-[var(--success)]/10",
  danger: "text-[var(--danger)] bg-[var(--danger)]/10",
  muted: "text-[var(--text-3)] bg-[var(--surface-1)]",
};

export function IconBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
