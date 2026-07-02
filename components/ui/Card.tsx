"use client";

import { type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "elevated" | "ghost";
  glow?: boolean;
  hover?: boolean;
};

export function Card({
  className,
  variant = "default",
  glow = false,
  hover = false,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors duration-200",
        variant === "default" && "bg-[var(--surface-1)] border-[var(--border-1)]",
        variant === "elevated" && "bg-[var(--surface-2)] border-[var(--border-2)]",
        variant === "ghost" && "bg-transparent border-transparent",
        hover && "hover:border-[var(--border-2)]",
        glow && "shadow-[0_0_60px_-30px_rgba(165,180,252,0.4)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function CardHeader({
  className,
  title,
  subtitle,
  action,
  children,
  ...rest
}: CardHeaderProps) {
  return (
    <div
      className={cn("flex items-center justify-between px-4 py-3 border-b border-[var(--border-1)]", className)}
      {...rest}
    >
      <div className="min-w-0 flex-1">
        {title && (
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-3)] font-mono truncate">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="text-[12px] text-[var(--text-2)] mt-0.5 truncate">{subtitle}</p>
        )}
        {children}
      </div>
      {action && <div className="ml-3 shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-t border-[var(--border-1)] flex items-center justify-between gap-2",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
