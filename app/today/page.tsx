"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell, CalendarRange, RefreshCw, ChevronRight, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type CalendarEvent } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { formatTime } from "@/lib/date";
import type { Intention, Reminder } from "@/lib/types";

function dayBounds(): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isLate(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

function SectionTitle({
  icon,
  children,
  href,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">
        <span className="text-[var(--accent)]">{icon}</span>
        {children}
      </h2>
      <Link
        href={href}
        className="flex items-center gap-0.5 text-[11px] text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
      >
        Tout voir
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function Row({
  time,
  title,
  meta,
  late,
  href,
}: {
  time?: string;
  title: string;
  meta?: string;
  late?: boolean;
  href?: string;
}) {
  const inner = (
    <div className="flex items-baseline gap-3 py-2 px-3 rounded-lg hover:bg-[var(--surface-2)]/60 transition-colors min-w-0">
      {time && (
        <span className="shrink-0 text-[11px] font-mono text-[var(--text-3)] w-11 tabular-nums">{time}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-1)]">{title}</span>
      {late && (
        <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider text-[var(--danger)] border border-[var(--danger)]/30 rounded px-1.5 py-0.5">
          En retard
        </span>
      )}
      {meta && <span className="shrink-0 text-[11px] text-[var(--text-3)]">{meta}</span>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function TodayPage() {
  const { start, end } = dayBounds();

  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [intentions, setIntentions] = useState<Intention[] | null>(null);
  const [intentionsError, setIntentionsError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (): Promise<CalendarEvent[]> => {
    const res = await api.calendar.list(start, end);
    if (res.error) throw new Error(res.error);
    return res.events ?? [];
  }, [start, end]);

  const {
    data: events,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useCachedFetch<CalendarEvent[]>("today:events", fetchEvents, { ttl: 2 * 60 * 1000 });

  const loadLocal = useCallback(() => {
    import("@/app/actions/reminders")
      .then(({ loadReminders }) => loadReminders())
      .then((data) => setReminders(data.reminders))
      .catch((err) => setRemindersError(err instanceof Error ? err.message : "Erreur"));
    import("@/app/actions/intentions")
      .then(({ loadIntentions }) => loadIntentions())
      .then((data) => setIntentions(data.intentions))
      .catch((err) => setIntentionsError(err instanceof Error ? err.message : "Erreur"));
  }, []);

  // Premier chargement des rappels et relances (l'agenda passe par useCachedFetch).
  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  const todayReminders = (reminders ?? [])
    .filter((r) => r.status === "pending" && new Date(r.dueAt).getTime() <= new Date(end).getTime())
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const todayIntentions = (intentions ?? [])
    .filter((i) => i.status === "pending" && new Date(i.dueAt).getTime() <= new Date(end).getTime())
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const dayEvents = (events ?? []).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const localLoading = reminders === null && intentions === null;
  const everythingEmpty =
    !localLoading &&
    todayReminders.length === 0 &&
    todayIntentions.length === 0 &&
    !eventsLoading &&
    (dayEvents.length === 0 || !!eventsError);

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Vue du jour"
            title="Aujourd'hui"
            description="Rappels, agenda et relances de la journée, rassemblés au même endroit."
          />

          {everythingEmpty ? (
            <EmptyState
              icon={<CalendarRange className="w-5 h-5" />}
              title="Rien de prévu"
              description="Aucun rappel, événement ou relance pour aujourd'hui. Profites-en."
              action={
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-md border border-[var(--border-2)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border-3)] transition-colors"
                >
                  Ouvrir la Console
                </Link>
              }
            />
          ) : (
            <div className="space-y-8">
              {/* Rappels */}
              <section>
                <SectionTitle icon={<Bell className="w-3.5 h-3.5" />} href="/reminders">
                  Rappels
                </SectionTitle>
                {remindersError && (
                  <p className="text-[11px] text-[var(--danger)] mb-2">{remindersError}</p>
                )}
                {reminders === null ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : todayReminders.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-3)] px-3 py-1.5">Aucun rappel pour aujourd'hui.</p>
                ) : (
                  <div className="border border-[var(--border-1)] rounded-xl overflow-hidden">
                    {todayReminders.map((r) => (
                      <Row
                        key={r.id}
                        time={formatTime(r.dueAt)}
                        title={r.title}
                        late={isLate(r.dueAt)}
                        href="/reminders"
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Agenda */}
              <section>
                <SectionTitle icon={<CalendarRange className="w-3.5 h-3.5" />} href="/calendar">
                  Agenda
                </SectionTitle>
                {eventsError ? (
                  <div className="flex flex-col gap-2 px-3 py-3 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger)]/8 text-[12px] text-[var(--text-2)]">
                    <span className="text-[var(--danger)]">
                      Impossible de charger l'agenda : {eventsError.message}
                    </span>
                    <span className="text-[11px] text-[var(--text-3)]">
                      Vérifie que ton compte Google est connecté dans les Paramètres.
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href="/api/auth/google?type=calendar"
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-md border border-[var(--border-2)] text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Connecter le calendrier
                      </a>
                      <button
                        onClick={() => void refetchEvents()}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-md border border-[var(--border-2)] text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Réessayer
                      </button>
                    </div>
                  </div>
                ) : eventsLoading && dayEvents.length === 0 ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : dayEvents.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-3)] px-3 py-1.5">Aucun événement aujourd'hui.</p>
                ) : (
                  <div className="border border-[var(--border-1)] rounded-xl overflow-hidden">
                    {dayEvents.map((e) => (
                      <Row
                        key={e.id}
                        time={formatTime(e.start)}
                        title={e.summary}
                        meta={e.location ?? undefined}
                        href="/calendar"
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Relances */}
              <section>
                <SectionTitle icon={<RefreshCw className="w-3.5 h-3.5" />} href="/week">
                  Relances
                </SectionTitle>
                {intentionsError && (
                  <p className="text-[11px] text-[var(--danger)] mb-2">{intentionsError}</p>
                )}
                {intentions === null ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : todayIntentions.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-3)] px-3 py-1.5">Aucune relance aujourd'hui.</p>
                ) : (
                  <div className="border border-[var(--border-1)] rounded-xl overflow-hidden">
                    {todayIntentions.map((i) => (
                      <Row
                        key={i.id}
                        time={formatTime(i.dueAt)}
                        title={i.subject}
                        late={isLate(i.dueAt)}
                        href="/week"
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
