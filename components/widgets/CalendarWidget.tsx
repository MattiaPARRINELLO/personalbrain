"use client";

import Link from "next/link";
import { CalendarRange, MapPin, Clock, ArrowUpRight, Loader2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type CalendarEvent } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isTomorrow(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate();
}

function dayLabel(iso: string): string {
  if (isToday(iso)) return "Aujourd'hui";
  if (isTomorrow(iso)) return "Demain";
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

const CALENDAR_CACHE_KEY = "calendar:list";

async function fetchWidgetCalendar(): Promise<CalendarEvent[]> {
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const res = await api.calendar.list(timeMin, timeMax);
  if (res.error) throw new Error(res.error);
  return (res.events ?? []).slice(0, 5);
}

export function CalendarWidget() {
  const { data: events, loading, error } = useCachedFetch<CalendarEvent[]>(
    CALENDAR_CACHE_KEY,
    fetchWidgetCalendar,
    { ttl: 2 * 60 * 1000 }
  );

  const visible = events ?? [];

  return (
    <Card variant="default" hover>
      <CardHeader
        title="Agenda"
        subtitle="7 prochains jours"
        action={
          <Link
            href="/calendar"
            className="text-[var(--text-3)] hover:text-[var(--accent)] transition-colors"
            title="Voir plus"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        }
      />
      <CardBody className="p-2">
        {error && visible.length === 0 && (
          <div className="text-[11px] text-[var(--danger)] px-3 py-2.5 rounded-md bg-[var(--danger)]/8 border border-[var(--danger)]/20">
            {error.message}
          </div>
        )}

        {loading && visible.length === 0 && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="px-3 py-6 text-center">
            <CalendarRange className="w-6 h-6 text-[var(--text-4)] mx-auto mb-2" />
            <p className="text-[11px] text-[var(--text-3)] font-mono">Aucun événement à venir</p>
          </div>
        )}

        {visible.length > 0 && (
          <ul className="space-y-0.5 relative">
            {loading && (
              <li className="absolute top-1 right-1">
                <Loader2 className="w-3 h-3 text-[var(--accent)] animate-spin" />
              </li>
            )}
            {visible.map((evt) => (
              <li
                key={evt.id}
                className="group px-3 py-2.5 rounded-md hover:bg-[var(--surface-2)] transition-colors duration-150"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-12 text-right">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent)]">
                      {dayLabel(evt.start)}
                    </div>
                    <div className="text-[10px] text-[var(--text-3)] font-mono mt-0.5">
                      {isToday(evt.start) || isTomorrow(evt.start) ? "" : formatTime(evt.start)}
                    </div>
                  </div>
                  <div className="shrink-0 w-px self-stretch bg-[var(--border-1)] group-hover:bg-[var(--border-2)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[var(--text-1)] truncate">
                      {evt.summary}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-3)] font-mono">
                      {!isToday(evt.start) && !isTomorrow(evt.start) && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTime(evt.start)}
                        </span>
                      )}
                      {evt.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{evt.location}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
