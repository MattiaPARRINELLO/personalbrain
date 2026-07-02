"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[#0a0a0b] hover:brightness-110 active:brightness-95",
  secondary:
    "bg-[var(--surface-3)] text-[var(--text-1)] border border-[var(--border-2)] hover:border-[var(--border-3)] hover:bg-[var(--surface-2)]",
  ghost:
    "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]",
  outline:
    "border border-[var(--border-2)] text-[var(--text-2)] hover:border-[var(--border-3)] hover:text-[var(--text-1)]",
  danger:
    "bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger)]/15",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[11px] gap-1.5 rounded-md",
  md: "h-8 px-3 text-[12px] gap-1.5 rounded-md",
  lg: "h-10 px-4 text-[13px] gap-2 rounded-lg",
  icon: "h-8 w-8 rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "secondary",
    size = "md",
    loading,
    disabled,
    leftIcon,
    rightIcon,
    children,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-200 select-none",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block w-3 h-3 border-2 border-current border-r-transparent rounded-full animate-spin"
          aria-hidden
        />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
