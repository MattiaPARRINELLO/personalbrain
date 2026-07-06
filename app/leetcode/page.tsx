"use client";

import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { loadLeetcode, syncLeetcode, getSmartSuggestion } from "@/app/actions/leetcode";
import type { LeetcodeData } from "@/lib/types";
import { Loader2, Flame, CheckCircle2, TrendingUp, Clock, Zap } from "lucide-react";

export default function LeetcodePage() {
  const [data, setData] = useState<LeetcodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [smartSuggestion, setSmartSuggestion] = useState<string>("");
  const [smartLoading, setSmartLoading] = useState(false);

  useEffect(() => {
    loadLeetcode().then(setData).catch(() => setError("Impossible de charger les données")).finally(() => setLoading(false));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const updated = await syncLeetcode();
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

  const totalSolved = data?.totalSolved ?? 0;
  const ranking = data?.ranking ?? 0;
  const streak = data?.streak ?? 0;
  const totalTime = (data?.exercises ?? []).reduce((acc, e) => acc + (e.duration ?? 0), 0);
  const hours = Math.floor(totalTime / 60);
  const mins = totalTime % 60;
  const recentExercises = (data?.exercises ?? []).slice(0, 10);
  const topPercent = ranking > 0 ? Math.max(0.1, Math.round((ranking / 3000000) * 10000) / 100) : 0;

  const radarSkills = useMemo(() => {
    const counts: Record<string, { solved: number; total: number }> = {
      Arrays: { solved: Math.round(totalSolved * 0.25), total: 200 },
      "Hash Table": { solved: Math.round(totalSolved * 0.15), total: 150 },
      "Linked List": { solved: Math.round(totalSolved * 0.08), total: 80 },
      Trees: { solved: Math.round(totalSolved * 0.12), total: 120 },
      DP: { solved: Math.round(totalSolved * 0.1), total: 150 },
      Graphs: { solved: Math.round(totalSolved * 0.05), total: 100 },
      "Two Pointers": { solved: Math.round(totalSolved * 0.08), total: 60 },
      "Sliding Window": { solved: Math.round(totalSolved * 0.05), total: 40 },
    };
    return Object.entries(counts).map(([name, c]) => ({
      name,
      solved: c.solved,
      total: c.total,
      value: c.total > 0 ? Math.round((c.solved / c.total) * 100) : 0,
    }));
  }, [totalSolved]);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-4 gap-4">
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

  const cx = 80, cy = 80, r = 60;
  const angleStep = (2 * Math.PI) / radarSkills.length;
  const points = radarSkills.map((_, i) => {
    const a = -Math.PI / 2 + i * angleStep;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  const dataPoints = radarSkills.map((skill, i) => {
    const a = -Math.PI / 2 + i * angleStep;
    const vr = (skill.value / 100) * r;
    return { x: cx + vr * Math.cos(a), y: cy + vr * Math.sin(a) };
  });
  const polygonPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <PageHeader
          title="LeetCode"
          description="Suis ta progression et trouve le bon exercice au bon moment."
          actions={
            <Button onClick={handleSync} disabled={syncing} variant="secondary">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {syncing ? "Synchro..." : "Synchroniser"}
            </Button>
          }
        />

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center"><Flame className="w-5 h-5 text-orange-400" /></div>
            <div><div className="text-2xl font-bold font-mono text-[var(--fg)]">{streak}</div><div className="text-xs text-[var(--muted)]">Streak (jours)</div></div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-emerald-400" /></div>
            <div><div className="text-2xl font-bold font-mono text-[var(--fg)]">{totalSolved}</div><div className="text-xs text-[var(--muted)]">Résolus</div></div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-blue-400" /></div>
            <div><div className="text-2xl font-bold font-mono text-[var(--fg)]">{topPercent}%</div><div className="text-xs text-[var(--muted)]">Top</div></div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center"><Clock className="w-5 h-5 text-purple-400" /></div>
            <div><div className="text-2xl font-bold font-mono text-[var(--fg)]">{hours}h{mins}</div><div className="text-xs text-[var(--muted)]">Temps total</div></div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
              Radar Compétences
            </h3>
            {radarSkills.length > 0 ? (
              <div className="flex justify-center">
                <svg viewBox="0 0 160 160" className="w-64 h-64">
                  <g transform="translate(0,0)">
                    {[0.2, 0.4, 0.6, 0.8, 1].map((level, li) => (
                      <polygon
                        key={li}
                        points={points.map((p) => {
                          const lx = cx + (p.x - cx) * level;
                          const ly = cy + (p.y - cy) * level;
                          return `${lx},${ly}`;
                        }).join(" ")}
                        fill="none"
                        stroke="var(--border-2)"
                        strokeWidth="0.5"
                      />
                    ))}
                    {points.map((p, i) => (
                      <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border-2)" strokeWidth="0.5" />
                    ))}
                    <polygon points={polygonPath} fill="var(--accent)" fillOpacity="0.15" stroke="var(--accent)" strokeWidth="1.5" />
                    {dataPoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" />
                    ))}
                    {radarSkills.map((skill, i) => {
                      const a = -Math.PI / 2 + i * angleStep;
                      const lx = cx + (r + 14) * Math.cos(a);
                      const ly = cy + (r + 14) * Math.sin(a);
                      return (
                        <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                          fontSize="6" fill="var(--muted)" fontFamily="Geist Sans, sans-serif">
                          {skill.name}
                        </text>
                      );
                    })}
                  </g>
                </svg>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)] text-center py-8">Pas assez de données</p>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
              Problème du jour
            </h3>
            {recentExercises.length > 0 ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-2)]">
                  <div className="text-sm font-medium text-[var(--fg)]">{recentExercises[0].title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Pill tone={recentExercises[0].difficulty === "Easy" ? "success" : recentExercises[0].difficulty === "Medium" ? "warm" : "danger"}>
                      {recentExercises[0].difficulty || "?"}
                    </Pill>
                    {recentExercises[0].duration && (
                      <span className="text-xs text-[var(--muted)]">{recentExercises[0].duration} min</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-2">Dernier exercice résolu</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-[var(--muted)] mb-3">Aucun exercice enregistré</p>
                <Button onClick={handleSmartSchedule} disabled={smartLoading} variant="secondary" size="sm">
                  {smartLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Smart Scheduler
                </Button>
              </div>
            )}
            <Button onClick={handleSmartSchedule} disabled={smartLoading} variant="secondary" size="sm" className="mt-3 w-full">
              {smartLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {smartLoading ? "Analyse..." : "Smart Scheduler — Trouver un créneau"}
            </Button>
            {smartSuggestion && (
              <div className="mt-3 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-2)] text-sm whitespace-pre-wrap">
                {smartSuggestion}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
              Derniers exercices
          </h3>
          {recentExercises.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-4">Aucun exercice résolu pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {recentExercises.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-2)]">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-[var(--fg)]">{ex.title}</div>
                      <div className="text-xs text-[var(--muted)]">{new Date(ex.createdAt).toLocaleDateString("fr-FR")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ex.difficulty && (
                      <Pill tone={ex.difficulty === "Easy" ? "success" : ex.difficulty === "Medium" ? "warm" : "danger"}>{ex.difficulty}</Pill>
                    )}
                    {ex.duration && <span className="text-xs text-[var(--muted)]">{ex.duration} min</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}


