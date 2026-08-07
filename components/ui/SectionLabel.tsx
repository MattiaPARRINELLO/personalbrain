"use client";

import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionLabel({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p
      className={cn(
        "text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]",
        className
      )}
      {...rest}
    >
      {children}
    </p>
  );
}
