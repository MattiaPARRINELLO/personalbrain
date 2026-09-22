"use client";

import Link from "next/link";
import { ArrowUpRight, Flame, Trophy, Zap } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCachedFetch } from "@/lib/cache";
import { loadLeetcode } from "@/app/actions/leetcode";
import { UNRANKED_RANKING } from "@/lib/leetcode-api";
import type { LeetcodeData } from "@/lib/types";

// Clé partagée : l'accueil et la page /leetcode lisent la même entrée, donc une
// seule synchronisation par fenêtre de 30 min (cf. SYNC_TTL_MS côté action).
export const LEETCODE_CACHE_KEY = "leetcode:data";
export const LEETCODE_TTL_MS = 30 * 60 * 1000;

export function LeetCodeWidget() {
  const { data, loading, error } = useCachedFetch<LeetcodeData>(
    LEETCODE_CACHE_KEY,
    loadLeetcode,
    { ttl: LEETCODE_TTL_MS }
  );

  const ranking = data?.ranking ?? 0;
  const ranked = ranking > 0 && ranking < UNRANKED_RANKING;

  return (
    <Card variant="default" hover>
      <CardHeader
        title="LeetCode"
        subtitle={data?.leetcodeUsername ?? "Non configuré"}
        action={
          <Link
            href="/leetcode"
            className="text-[var(--text-3)] hover:text-[var(--accent)] transition-colors duration-200"
            title="Ouvrir la page LeetCode"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        }
      />
      <CardBody>
        {(error || data?.syncError) && (
          <div className="text-[11px] text-[var(--danger)] px-3 py-2 rounded-md bg-[var(--danger)]/8 border border-[var(--danger)]/20 mb-3 line-clamp-3">
            {error?.message ?? data?.syncError}
          </div>
        )}

        {loading && !data && (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-3" />
          </div>
        )}

        {data && !data.leetcodeUsername && (
          <div className="text-[11px] text-[var(--text-3)] leading-relaxed">
            Renseigne ton pseudo dans les{" "}
            <Link href="/settings" className="text-[var(--accent)] hover:underline">
              réglages
            </Link>{" "}
            pour suivre ta progression réelle.
          </div>
        )}

        {data?.leetcodeUsername && (
          <div className="flex items-center gap-5">
            <StreakGauge streak={data.streak} />
            <div className="flex-1 min-w-0 space-y-2">
              <StatRow label="Total" value={data.totalSolved ?? 0} tone="text-[var(--text-1)]" />
              <StatRow label="Easy" value={data.easySolved ?? 0} tone="text-[var(--success)]" />
              <StatRow label="Medium" value={data.mediumSolved ?? 0} tone="text-[var(--warm)]" />
              <StatRow label="Hard" value={data.hardSolved ?? 0} tone="text-[var(--danger)]" />
            </div>
          </div>
        )}

        {data?.leetcodeUsername && (
          <div className="mt-3 pt-2.5 border-t border-[var(--border-1)] space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3 h-3 text-[var(--warm)]" />
              <span className="text-[10px] font-mono text-[var(--text-3)] uppercase tracking-wider">
                Rang
              </span>
              <span className="text-[10px] font-mono text-[var(--text-1)] ml-auto tabular-nums">
                {ranked ? `#${ranking.toLocaleString("fr-FR")}` : "non classé"}
              </span>
            </div>
            {(data.totalSubmissions ?? 0) > 0 && (
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-[var(--accent-cool)]" />
                <span className="text-[10px] font-mono text-[var(--text-3)] uppercase tracking-wider">
                  Soumissions
                </span>
                <span className="text-[10px] font-mono text-[var(--text-1)] ml-auto tabular-nums">
                  {(data.totalSubmissions ?? 0).toLocaleString("fr-FR")}
                </span>
              </div>
            )}
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
