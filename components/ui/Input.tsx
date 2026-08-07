"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none transition-colors duration-200 focus:border-[var(--accent)]/70";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(fieldBase, className)} {...rest} />;
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "resize-none", className)} {...rest} />;
});

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="block mb-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">
          {label}
        </span>
      )}
      {children}
      {hint && <span className="block mt-1 text-[11px] text-[var(--text-4)]">{hint}</span>}
    </label>
  );
}
