"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, MapPin, User } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { api, type ScheduleCourse } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SCHEDULE_CACHE_KEY = "schedule:all";
const TTL = 10 * 60 * 1000;

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  return d;
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const { data, loading, error, refetch } = useCachedFetch<ScheduleCourse[]>(
    SCHEDULE_CACHE_KEY,
    useCallback(async () => {
      const res = await api.schedule.get();
      if (res.error) throw new Error(res.error);
      return res.courses ?? [];
    }, []),
    { ttl: TTL }
  );
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const weekStart = useMemo(() => {
    const monday = mondayOf(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);
    return monday;
  }, [weekOffset]);

  const days = useMemo(() => {
    const courses = data ?? [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const key = dayKey(date.getTime());
      const list = courses
        .filter((c) => dayKey(c.start) === key)
        .sort((a, b) => a.start - b.start);
      return { date, key, list };
    });
  }, [data, weekStart]);

  const totalWeek = days.reduce((sum, d) => sum + d.list.length, 0);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await api.schedule.sync();
      if (res.error) throw new Error(res.error);
      await refetch();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync impossible");
    } finally {
      setSyncing(false);
    }
  };

  const weekLabel = `${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${new Date(
    weekStart.getTime() + 6 * 86_400_000
  ).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Emploi du temps"
        title="Semaine"
        description="Cours CESAR synchronisés automatiquement (toutes les 6 h) : horaires, salles et intervenants."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Semaine précédente">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              Cette semaine
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Semaine suivante">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSync} loading={syncing} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Sync
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]">{weekLabel}</p>
        <p className="text-[12px] text-[var(--text-3)]">{totalWeek} séance{totalWeek > 1 ? "s" : ""}</p>
      </div>

      {syncError && <p className="text-[12px] text-[var(--danger)] mb-3">{syncError}</p>}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Emploi du temps indisponible" description={error.message} />
      ) : totalWeek === 0 ? (
        <EmptyState title="Aucun cours cette semaine" description="Lance une synchronisation pour récupérer l'EDT depuis CESAR." />
      ) : (
        <div className="grid gap-3 md:grid-cols-5">
          {days.slice(0, 5).map((day) => (
            <div key={day.key} className="min-w-0">
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">
                  {DAY_LABELS[(day.date.getDay() + 6) % 7]}
                </h2>
                <span className="text-[11px] text-[var(--text-3)]">
                  {day.date.toLocaleDateString("fr-FR", { day: "numeric", month: "numeric" })}
                </span>
              </div>
              <div className="space-y-2">
                {day.list.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[var(--border-1)] h-16 flex items-center justify-center text-[11px] text-[var(--text-3)]">
                    Libre
                  </div>
                )}
                {day.list.map((c) => (
                  <Card key={`${c.uuid}-${c.start}`} variant="default" className="p-3">
                    <p className="text-[12px] font-medium text-[var(--text-1)] leading-snug">{c.subject}</p>
                    <p className="text-[11px] font-mono text-[var(--accent)] mt-1">
                      {hhmm(c.start)}–{hhmm(c.end)}
                    </p>
                    {c.room && (
                      <p className="flex items-start gap-1 mt-1.5 text-[11px] text-[var(--text-2)]">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="min-w-0">{c.room}</span>
                      </p>
                    )}
                    {c.teacher && (
                      <p className="flex items-center gap-1 mt-1 text-[11px] text-[var(--text-3)]">
                        <User className="w-3 h-3 shrink-0" />
                        <span className="truncate">{c.teacher}</span>
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {days.some((d) => d.list.length > 0) && (
        <p className="flex items-center gap-1.5 mt-6 text-[11px] text-[var(--text-3)]">
          <CalendarDays className="w-3.5 h-3.5" />
          Notifications push 30 min avant chaque cours (salle incluse).
        </p>
      )}
    </AppShell>
  );
}
