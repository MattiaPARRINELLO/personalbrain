"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md";

const sizeClasses: Record<Size, string> = {
  xs: "w-6 h-6 rounded-md",
  sm: "w-7 h-7 rounded-md",
  md: "w-9 h-9 rounded-lg",
};

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: Size;
  tone?: "default" | "danger";
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "sm", tone = "default", className, children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center shrink-0 transition-colors duration-200",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
        sizeClasses[size],
        tone === "danger"
          ? "text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10"
          : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
