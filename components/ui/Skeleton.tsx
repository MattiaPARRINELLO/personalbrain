"use client";

import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-gradient-to-r from-[var(--surface-2)] via-[var(--surface-3)] to-[var(--surface-2)] bg-[length:200%_100%] animate-[shimmer_1.6s_ease-in-out_infinite]",
        className
      )}
      {...rest}
    />
  );
}

export function SkeletonLines({ lines = 3, lastWidth = "60%" }: { lines?: number; lastWidth?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={i === lines - 1 ? { width: lastWidth } : undefined}
        />
      ))}
    </div>
  );
}
