"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { IconBadge } from "@/components/ui/IconBadge";
import { loadLeetcode, syncLeetcode, getSmartSuggestion } from "@/app/actions/leetcode";
import { LEETCODE_CACHE_KEY } from "@/components/widgets/LeetCodeWidget";
import { invalidateCache } from "@/lib/cache";
import { UNRANKED_RANKING } from "@/lib/leetcode-api";
import { activityLevel, buildActivityGrid } from "@/lib/leetcode-utils";
import type { LeetcodeData } from "@/lib/types";
import { Loader2, Flame, CheckCircle2, TrendingUp, Zap, RefreshCw, CalendarRange } from "lucide-react";

const WEEKS = 17;

const LEVEL_CLASS = [
  "bg-[var(--surface-3)]",
  "bg-[var(--accent)]/25",
  "bg-[var(--accent)]/45",
  "bg-[var(--accent)]/70",
  "bg-[var(--accent)]",
];

export default function LeetcodePage() {
  const [data, setData] = useState<LeetcodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [smartSuggestion, setSmartSuggestion] = useState<string>("");
  const [smartLoading, setSmartLoading] = useState(false);

  useEffect(() => {
    loadLeetcode()
      .then(setData)
      .catch(() => setError("Impossible de charger les données"))
      .finally(() => setLoading(false));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    try {
      const updated = await syncLeetcode();
      // Le cache partagé du widget doit voir la nouvelle valeur, sinon la carte
      // du panneau de droite garderait l'ancienne pendant 30 min.
      invalidateCache(LEETCODE_CACHE_KEY);
      setData(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  const handleSmartSchedule = async () => {
    setSmartLoading(true);
    try {
      const suggestion = await getSmartSuggestion();
      setSmartSuggestion(suggestion);
    } catch {
      setSmartSuggestion("Impossible d'analyser ton calendrier.");
    } finally {
      setSmartLoading(false);
    }
  };

  const grid = useMemo(
    () => buildActivityGrid(data?.submissions?.calendar ?? {}, WEEKS),
    [data]
  );
  const windowSubmissions = useMemo(
    () => grid.flat().reduce((sum, day) => sum + day.count, 0),
    [grid]
  );

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="p-6">
          <EmptyState
            title="LeetCode"
            description={error || "Connecte ton compte LeetCode pour commencer."}
          />
        </div>
      </AppShell>
    );
  }

  if (!data.leetcodeUsername) {
    return (
      <AppShell>
        <div className="p-6 space-y-4">
          <PageHeader
            eyebrow="Série de code"
            title="LeetCode"
            description="Suis ta progression et trouve le bon exercice au bon moment."
          />
          <Card className="p-6">
            <p className="text-sm text-[var(--text-2)] leading-relaxed">
              Aucun pseudo LeetCode n&apos;est enregistré, donc rien ne peut être
              synchronisé. Renseigne-le dans les{" "}
              <Link href="/settings" className="text-[var(--accent)] hover:underline">
                réglages
              </Link>{" "}
              : le pseudo est vérifié auprès de l&apos;API avant d&apos;être enregistré.
            </p>
          </Card>
        </div>
      </AppShell>
    );
  }

  const ranking = data.ranking ?? 0;
  const ranked = ranking > 0 && ranking < UNRANKED_RANKING;
  const contest = data.contest;
  const exercises = data.exercises ?? [];

  const stats = [
    { key: "streak", icon: Flame, tone: "warm" as const, label: "Série (jours)", value: data.streak },
    { key: "solved", icon: CheckCircle2, tone: "success" as const, label: "Résolus", value: data.totalSolved ?? 0 },
    { key: "subs", icon: Zap, tone: "accent" as const, label: "Soumissions acceptées", value: data.totalSubmissions ?? 0 },
    { key: "rank", icon: TrendingUp, tone: "neutral" as const, label: "Rang", value: ranked ? `#${ranking.toLocaleString("fr-FR")}` : "non classé" },
  ];

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <PageHeader
          eyebrow="Série de code"
          title="LeetCode"
          description={`Compte ${data.leetcodeUsername} — suivi réel de ta progression.`}
          actions={
            <Button onClick={handleSync} disabled={syncing} variant="secondary">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? "Synchro..." : "Synchroniser"}
            </Button>
          }
        />

        {(error || data.syncError) && (
          <div className="p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm">
            {error || data.syncError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.key} className="p-4 flex items-center gap-3">
                <IconBadge tone={stat.tone} className="w-10 h-10">
                  <Icon className="w-5 h-5" />
                </IconBadge>
                <div className="min-w-0">
                  <div className="text-2xl font-bold font-mono text-[var(--text-1)] tabular-nums truncate">
                    {stat.value}
                  </div>
                  <div className="text-xs text-[var(--text-3)]">{stat.label}</div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-baseline justify-between mb-4 gap-3">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]">
                Activité — {WEEKS} dernières semaines
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-3)] tabular-nums shrink-0">
                {windowSubmissions} soumission{windowSubmissions > 1 ? "s" : ""} déposée
                {windowSubmissions > 1 ? "s" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="flex gap-[3px] w-max">
                {grid.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((day) => (
                      <div
                        key={day.key}
                        title={`${day.key} — ${day.count} soumission${day.count > 1 ? "s" : ""}`}
                        className={`w-3 h-3 rounded-[3px] ${LEVEL_CLASS[activityLevel(day.count)]}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-4 text-[11px] text-[var(--text-3)]">
              {data.submissions?.totalActiveDays ?? 0} jour
              {(data.submissions?.totalActiveDays ?? 0) > 1 ? "s" : ""} d&apos;activité au total
              {data.syncedAt && (
                <> · dernière synchro {new Date(data.syncedAt).toLocaleString("fr-FR")}</>
              )}
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)] mb-4">
              Contest
            </h3>
            {contest ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold font-mono text-[var(--text-1)] tabular-nums">
                    {contest.rating}
                  </div>
                  {contest.badge && <Pill tone="warm">{contest.badge}</Pill>}
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-3)] font-mono uppercase tracking-wider text-[10px]">
                      Participations
                    </span>
                    <span className="font-mono tabular-nums text-[var(--text-1)]">{contest.attended}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-3)] font-mono uppercase tracking-wider text-[10px]">
                      Top
                    </span>
                    <span className="font-mono tabular-nums text-[var(--text-1)]">{contest.topPercentage}%</span>
                  </div>
                  {contest.globalRanking > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-3)] font-mono uppercase tracking-wider text-[10px]">
                        Rang global
                      </span>
                      <span className="font-mono tabular-nums text-[var(--text-1)]">
                        #{contest.globalRanking.toLocaleString("fr-FR")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-3)] leading-relaxed">
                Aucun contest enregistré sur ce compte — le rating apparaîtra après
                ta première participation.
              </p>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <h3 className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)] mb-4">
              Répartition par difficulté
            </h3>
            <div className="space-y-3">
              <DifficultyBar
                label="Easy"
                solved={data.easySolved ?? 0}
                total={data.totalSolved ?? 0}
                tone="var(--success)"
              />
              <DifficultyBar
                label="Medium"
                solved={data.mediumSolved ?? 0}
                total={data.totalSolved ?? 0}
                tone="var(--warm)"
              />
              <DifficultyBar
                label="Hard"
                solved={data.hardSolved ?? 0}
                total={data.totalSolved ?? 0}
                tone="var(--danger)"
              />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)] mb-4">
              Créneau du jour
            </h3>
            <p className="text-sm text-[var(--text-3)] leading-relaxed mb-3">
              Croise ton agenda du jour avec ta progression pour proposer une
              difficulté adaptée au temps libre réel.
            </p>
            <Button onClick={handleSmartSchedule} disabled={smartLoading} variant="secondary" size="sm" className="w-full">
              {smartLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarRange className="w-4 h-4" />}
              {smartLoading ? "Analyse..." : "Analyser mon agenda"}
            </Button>
            {smartSuggestion && (
              <div className="mt-3 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-2)] text-sm whitespace-pre-wrap">
                {smartSuggestion}
              </div>
            )}
          </Card>
        </div>

        {exercises.length > 0 && (
          <Card className="p-5">
            <h3 className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)] mb-4">
              Exercices enregistrés
            </h3>
            <div className="space-y-2">
              {exercises.slice(0, 10).map((ex) => (
                <div key={ex.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-2)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--text-1)] truncate">{ex.title}</div>
                      <div className="text-xs text-[var(--text-3)]">{new Date(ex.createdAt).toLocaleDateString("fr-FR")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ex.difficulty && (
                      <Pill tone={ex.difficulty === "Easy" ? "success" : ex.difficulty === "Medium" ? "warm" : "danger"}>
                        {ex.difficulty}
                      </Pill>
                    )}
                    {ex.duration && <span className="text-xs text-[var(--text-3)]">{ex.duration} min</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function DifficultyBar({
  label,
  solved,
  total,
  tone,
}: {
  label: string;
  solved: number;
  total: number;
  tone: string;
}) {
  const share = total > 0 ? (solved / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] mb-1.5">
        <span className="text-[var(--text-3)] font-mono uppercase tracking-wider text-[10px]">
          {label}
        </span>
        <span className="font-mono tabular-nums text-[var(--text-1)]">
          {solved}
          <span className="text-[var(--text-4)]"> · {Math.round(share)}%</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${share}%`, background: tone }}
        />
      </div>
    </div>
  );
}
