"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, MapPin, RefreshCw, User } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { api, type ScheduleCourse } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SCHEDULE_CACHE_KEY = "schedule:all";
const TTL = 10 * 60 * 1000;

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi = 0
  return d;
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Tronque une salle longue ("Salle 13, Bâtiment principal" → "Salle 13") sans perdre l'info au survol. */
function shortRoom(room: string): string {
  return room.split(",")[0]?.trim() || room;
}

/** Nombre de semaines (lundi à lundi) entre deux dates. */
function weeksBetween(fromMonday: Date, target: Date): number {
  const a = mondayOf(fromMonday).getTime();
  const b = mondayOf(target).getTime();
  return Math.round((b - a) / (7 * 86_400_000));
}

export default function SchedulePage() {
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
  // null = navigation automatique (voir autoOffset) ; un nombre = choix de l'utilisateur.
  const [userOffset, setUserOffset] = useState<number | null>(null);

  const [today] = useState(() => new Date());
  const todayKey = dayKey(today.getTime());

  // Sans choix explicite : si la semaine courante est vide (vacances, avant la
  // rentrée…), on ouvre directement la semaine du prochain cours.
  const autoOffset = useMemo(() => {
    const courses = data ?? [];
    const monday = mondayOf(today);
    const nowMs = today.getTime();
    const weekEnd = monday.getTime() + 7 * 86_400_000;
    const hasCurrentWeek = courses.some((c) => c.start >= monday.getTime() && c.start < weekEnd);
    if (hasCurrentWeek) return 0;
    const next = courses
      .filter((c) => c.end > nowMs)
      .sort((a, b) => a.start - b.start)[0];
    return next ? weeksBetween(monday, new Date(next.start)) : 0;
  }, [data, today]);

  const weekOffset = userOffset ?? autoOffset;

  const weekStart = useMemo(() => {
    const monday = mondayOf(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);
    return monday;
  }, [weekOffset]);

  const days = useMemo(() => {
    const courses = data ?? [];
    return Array.from({ length: 5 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const key = dayKey(date.getTime());
      return {
        date,
        key,
        list: courses.filter((c) => dayKey(c.start) === key).sort((a, b) => a.start - b.start),
      };
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

  const weekLabel = `${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} – ${new Date(
    weekStart.getTime() + 4 * 86_400_000
  ).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Emploi du temps"
            title="Ma semaine"
            description="Cours CESAR synchronisés automatiquement (toutes les 6 h) — notifications 30 min avant, salle incluse."
            actions={
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setUserOffset(weekOffset - 1)}
                  aria-label="Semaine précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant={weekOffset === 0 ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setUserOffset(0)}
                >
                  Cette semaine
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setUserOffset(weekOffset + 1)}
                  aria-label="Semaine suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSync}
                  loading={syncing}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Sync
                </Button>
              </div>
            }
          />

          {weekOffset !== 0 && (
            <p className="text-[12px] text-[var(--text-2)] mb-4 px-3 py-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)]">
              {weekOffset > 0
                ? "Pas de cours cette semaine — voici la semaine du prochain cours."
                : "Semaine passée."}{" "}
              <button
                onClick={() => setUserOffset(0)}
                className="underline underline-offset-2 text-[var(--accent)] hover:brightness-110"
              >
                Revenir à cette semaine
              </button>
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">
              {weekLabel}
            </p>
            <p className="text-[12px] text-[var(--text-3)]">
              {totalWeek === 0 ? "Aucune séance" : `${totalWeek} séance${totalWeek > 1 ? "s" : ""}`}
            </p>
          </div>

          {syncError && (
            <p className="text-[12px] text-[var(--danger)] mb-4 px-3 py-2 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/8">
              {syncError}
            </p>
          )}

          {loading ? (
            <div className="grid gap-3 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : error ? (
            <EmptyState title="Emploi du temps indisponible" description={error.message} />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-5">
                {days.map((day) => {
                  const isToday = day.key === todayKey;
                  return (
                    <div
                      key={day.key}
                      className={cn(
                        "rounded-xl border p-3 min-w-0",
                        isToday
                          ? "border-[var(--accent)]/35 bg-[var(--accent)]/5"
                          : "border-[var(--border-1)] bg-[var(--surface-1)]"
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <h2
                          className={cn(
                            "text-[11px] font-mono uppercase tracking-[0.16em]",
                            isToday ? "text-[var(--accent)]" : "text-[var(--text-3)]"
                          )}
                        >
                          {DAY_LABELS[(day.date.getDay() + 6) % 7].slice(0, 3)}
                        </h2>
                        <span className="text-[11px] text-[var(--text-3)] tabular-nums">
                          {day.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                        </span>
                      </div>

                      {day.list.length === 0 ? (
                        <p className="text-[11px] text-[var(--text-3)] py-6 text-center">Libre</p>
                      ) : (
                        <div className="space-y-2 mt-2">
                          {day.list.map((c) => (
                            <div
                              key={`${c.uuid}-${c.start}`}
                              className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] px-2.5 py-2"
                            >
                              <p className="text-[11px] font-mono text-[var(--accent)] tabular-nums leading-none">
                                {hhmm(c.start)}–{hhmm(c.end)}
                              </p>
                              <p className="text-[12.5px] font-medium text-[var(--text-1)] leading-snug mt-1.5 break-words">
                                {c.subject.replace(/^E\d+\s+/, "")}
                              </p>
                              {c.remote ? (
                                <p className="text-[10.5px] text-[var(--text-3)] mt-1">Distanciel</p>
                              ) : (
                                c.room && (
                                  <p
                                    className="flex items-center gap-1 text-[10.5px] text-[var(--text-3)] mt-1 min-w-0"
                                    title={c.room}
                                  >
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{shortRoom(c.room)}</span>
                                  </p>
                                )
                              )}
                              {c.teacher && (
                                <p className="flex items-center gap-1 text-[10.5px] text-[var(--text-3)] mt-0.5 min-w-0">
                                  <User className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{c.teacher}</span>
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {totalWeek > 0 && (
                <p className="flex items-center gap-1.5 mt-6 text-[11px] text-[var(--text-3)]">
                  <CalendarClock className="w-3.5 h-3.5" />
                  Notification push 30 min avant chaque cours, avec la salle.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
