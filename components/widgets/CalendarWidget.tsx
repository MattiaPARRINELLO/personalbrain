"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, MapPin, Clock, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type CalendarEvent } from "@/lib/api-client";

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

export function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.calendar
      .list()
      .then((res) => {
        if (cancelled) return;
        setEvents((res.events ?? []).slice(0, 5));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erreur de chargement");
        setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card variant="default" hover>
      <CardHeader
        title="Agenda"
        subtitle="7 prochains jours"
        action={
          <Link
            href="/brain"
            className="text-[var(--text-3)] hover:text-[var(--accent)] transition-colors"
            title="Voir plus"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        }
      />
      <CardBody className="p-2">
        {error && (
          <div className="text-[11px] text-[var(--danger)] px-3 py-2.5 rounded-md bg-[var(--danger)]/8 border border-[var(--danger)]/20">
            {error}
          </div>
        )}

        {events === null && !error && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}

        {events !== null && events.length === 0 && !error && (
          <div className="px-3 py-6 text-center">
            <CalendarRange className="w-6 h-6 text-[var(--text-4)] mx-auto mb-2" />
            <p className="text-[11px] text-[var(--text-3)] font-mono">Aucun événement à venir</p>
          </div>
        )}

        {events && events.length > 0 && (
          <ul className="space-y-0.5">
            {events.map((evt) => (
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
