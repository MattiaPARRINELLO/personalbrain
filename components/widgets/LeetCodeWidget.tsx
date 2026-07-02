"use client";

import { useEffect, useState } from "react";
import { Flame, Trophy, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { loadLeetcode } from "@/app/actions/leetcode";
import type { LeetcodeData } from "@/lib/types";

export function LeetCodeWidget() {
  const [data, setData] = useState<LeetcodeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeetcode()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Erreur"));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card variant="default" hover>
      <CardHeader
        title="LeetCode"
        subtitle={data?.leetcodeUsername ?? "Compagnon de code"}
        action={
          <ArrowUpRight className="w-3.5 h-3.5 text-[var(--text-3)]" />
        }
      />
      <CardBody>
        {error && (
          <div className="text-[11px] text-[var(--danger)] px-3 py-2 rounded-md bg-[var(--danger)]/8 border border-[var(--danger)]/20 mb-3">
            {error}
          </div>
        )}

        {!data && !error && (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-3" />
          </div>
        )}

        {data && (
          <div className="flex items-center gap-5">
            <StreakGauge streak={data.streak} />
            <div className="flex-1 min-w-0 space-y-2">
              <StatRow
                label="Total"
                value={data.totalSolved ?? 0}
                tone="text-[var(--text-1)]"
              />
              <StatRow label="Easy" value={data.easySolved ?? 0} tone="text-[var(--success)]" />
              <StatRow label="Medium" value={data.mediumSolved ?? 0} tone="text-[var(--warm)]" />
              <StatRow label="Hard" value={data.hardSolved ?? 0} tone="text-[var(--danger)]" />
              {(data.ranking ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 pt-1.5 mt-1 border-t border-[var(--border-1)]">
                  <Trophy className="w-3 h-3 text-[var(--warm)]" />
                  <span className="text-[10px] font-mono text-[var(--text-3)] uppercase tracking-wider">
                    Rang
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-1)] ml-auto tabular-nums">
                    #{(data.ranking ?? 0).toLocaleString("fr-FR")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function StreakGauge({ streak }: { streak: number }) {
  const target = Math.max(streak, 7);
  const progress = Math.min(streak / target, 1);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - progress * circumference;

  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 60 60">
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="none"
          stroke="var(--border-1)"
          strokeWidth="4"
        />
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="none"
          stroke="url(#streakGrad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
        <defs>
          <linearGradient id="streakGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Flame className="w-3.5 h-3.5 text-[var(--warm)]" />
        <span className="text-[14px] font-semibold text-[var(--text-1)] font-mono tabular-nums leading-none mt-0.5">
          {streak}
        </span>
      </div>
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-[var(--text-3)] font-mono uppercase tracking-wider text-[10px]">
        {label}
      </span>
      <span className={`font-mono tabular-nums font-medium ${tone}`}>{value}</span>
    </div>
  );
}
