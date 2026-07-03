"use client";

import { useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { api, type CalendarEvent } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { cn } from "@/lib/utils";

const EVENT_COLORS: Record<string, { bg: string; fg: string; name: string }> = {
  "1":  { bg: "#a4bdfc", fg: "#1d1d1d", name: "Lavande" },
  "2":  { bg: "#7ae7bf", fg: "#1d1d1d", name: "Sauge" },
  "3":  { bg: "#dbadff", fg: "#1d1d1d", name: "Raisin" },
  "4":  { bg: "#ff887c", fg: "#1d1d1d", name: "Flamant" },
  "5":  { bg: "#fbd75b", fg: "#1d1d1d", name: "Banane" },
  "6":  { bg: "#ffb878", fg: "#1d1d1d", name: "Mandarine" },
  "7":  { bg: "#46d6db", fg: "#1d1d1d", name: "Paon" },
  "8":  { bg: "#e1e1e1", fg: "#1d1d1d", name: "Graphite" },
  "9":  { bg: "#5484ed", fg: "#ffffff", name: "Myrtille" },
  "10": { bg: "#51b749", fg: "#1d1d1d", name: "Basilic" },
  "11": { bg: "#dc2127", fg: "#ffffff", name: "Tomate" },
};

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function isAllDay(evt: CalendarEvent): boolean {
  return !evt.start.includes("T");
}

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((dayStart(a).getTime() - dayStart(b).getTime()) / (24 * 60 * 60 * 1000));
}

function eventEndInclusive(evt: CalendarEvent): Date {
  const end = new Date(evt.end);
  if (isAllDay(evt)) {
    return addDays(end, -1);
  }
  return end;
}

function isMultiDay(evt: CalendarEvent): boolean {
  const start = dayStart(new Date(evt.start));
  const end = dayStart(eventEndInclusive(evt));
  return start.getTime() !== end.getTime();
}

function isSpanningOrAllDay(evt: CalendarEvent): boolean {
  return isAllDay(evt) || isMultiDay(evt);
}

function visibleSpan(evt: CalendarEvent, weekStart: Date): { startCol: number; endCol: number } | null {
  const weekEnd = addDays(weekStart, 7);
  const evtStart = new Date(evt.start);
  const evtEnd = eventEndInclusive(evt);

  const visibleStart = dayStart(evtStart) < dayStart(weekStart) ? weekStart : evtStart;
  const visibleEnd = dayStart(evtEnd) >= dayStart(weekEnd) ? addDays(weekEnd, -1) : evtEnd;

  if (dayStart(visibleStart) > dayStart(visibleEnd)) return null;

  const startCol = Math.max(0, diffDays(dayStart(visibleStart), weekStart));
  const endCol = Math.min(6, diffDays(dayStart(visibleEnd), weekStart));

  return { startCol, endCol };
}

function layoutMultiDayLanes(events: CalendarEvent[], weekStart: Date): CalendarEvent[][] {
  const spans = events
    .map((e) => ({ evt: e, span: visibleSpan(e, weekStart) }))
    .filter((x): x is { evt: CalendarEvent; span: { startCol: number; endCol: number } } => x.span !== null)
    .sort((a, b) => a.span.startCol - b.span.startCol || a.evt.summary.localeCompare(b.evt.summary));

  const lanes: { evt: CalendarEvent; span: { startCol: number; endCol: number } }[][] = [];
  for (const item of spans) {
    let placed = false;
    for (const lane of lanes) {
      const last = lane[lane.length - 1];
      if (last.span.endCol < item.span.startCol) {
        lane.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([item]);
    }
  }
  return lanes.map((lane) => lane.map((i) => i.evt));
}

function monthWeeks(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const weeks: { days: (number | null)[]; start: Date }[] = [];

  const current = new Date(year, month, 1 - startPad);
  while (current <= last) {
    const days: (number | null)[] = [];
    const weekStart = new Date(current);
    for (let i = 0; i < 7; i++) {
      days.push(current.getMonth() === month ? current.getDate() : null);
      current.setDate(current.getDate() + 1);
    }
    weeks.push({ days, start: weekStart });
  }

  return weeks;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function monthRangeKey(year: number, month: number): { timeMin: string; timeMax: string; cacheKey: string } {
  const first = new Date(year, month, 1);
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const start = new Date(year, month, 1 - startPad);
  start.setHours(0, 0, 0, 0);

  const last = new Date(year, month + 1, 0);
  const endPad = last.getDay() === 0 ? 0 : 7 - last.getDay();
  const end = new Date(year, month + 1, endPad);
  end.setHours(23, 59, 59, 999);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    cacheKey: `calendar:list:${start.toISOString()}:${end.toISOString()}`,
  };
}

export default function CalendarPage() {
  const [today] = useState(() => new Date());
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const { timeMin, timeMax, cacheKey } = monthRangeKey(year, month);

  const fetchCalendarEvents = useCallback(async (): Promise<CalendarEvent[]> => {
    const res = await api.calendar.list(timeMin, timeMax);
    if (res.error) throw new Error(res.error);
    return res.events ?? [];
  }, [timeMin, timeMax]);

  const {
    data: events,
    loading,
    error,
    refetch: fetchEvents,
  } = useCachedFetch<CalendarEvent[]>(cacheKey, fetchCalendarEvents, {
    ttl: 2 * 60 * 1000,
  });

  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState({ summary: "", description: "", location: "", colorId: "" });
  const [saving, setSaving] = useState(false);

  const weeks = monthWeeks(year, month);
  const todayStr = today.toDateString();

  function timedEventsForDay(day: number): CalendarEvent[] {
    const dateStr = new Date(year, month, day).toDateString();
    return (events ?? []).filter((e) => {
      if (isSpanningOrAllDay(e)) return false;
      return new Date(e.start).toDateString() === dateStr;
    });
  }

  function multiDayEventsForWeek(weekStart: Date): CalendarEvent[] {
    return (events ?? []).filter((e) => isSpanningOrAllDay(e)).filter((e) => {
      const span = visibleSpan(e, weekStart);
      return span !== null;
    });
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  function openEdit(evt: CalendarEvent) {
    setIsCreating(false);
    setEditing(evt);
    setEditForm({
      summary: evt.summary,
      description: evt.description ?? "",
      location: evt.location ?? "",
      colorId: evt.colorId ?? "",
    });
  }

  function createNewEvent(day?: number) {
    const start = new Date(year, month, day ?? today.getDate(), 10, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    setIsCreating(true);
    setEditing({
      id: "",
      summary: "",
      description: "",
      location: "",
      start: start.toISOString(),
      end: end.toISOString(),
    });
    setEditForm({ summary: "", description: "", location: "", colorId: "" });
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      if (isCreating) {
        await api.calendar.create({
          summary: editForm.summary || "(Sans titre)",
          start: editing.start,
          end: editing.end,
          description: editForm.description,
          location: editForm.location,
        });
      } else {
        await api.calendar.update(editing.id, editForm);
      }
      setEditing(null);
      setIsCreating(false);
      await fetchEvents();
    } catch (err) {
      console.error("Save error", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Google Calendar"
            title="Calendrier"
            description="Vue mensuelle de tes événements synchronisés."
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => createNewEvent()}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-md border border-[var(--border-2)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border-3)] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nouvel événement
                </button>
                <a
                  href="/api/auth/google?type=calendar"
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-md border border-[var(--border-2)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border-3)] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ouvrir dans Google
                </a>
              </div>
            }
          />

          {error && (
            <div className="text-[11px] text-[var(--danger)] px-3 py-2.5 rounded-md bg-[var(--danger)]/8 border border-[var(--danger)]/20 mb-6">
              {error.message}
            </div>
          )}

          <Card>
            <CardBody className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-1)]">
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-[14px] font-semibold text-[var(--text-1)]">
                  {MONTHS[month]} {year}
                </h2>
                <button
                  onClick={nextMonth}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {loading && !events && (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              )}

              {events && (
                <div>
                  <div className="grid grid-cols-7 border-b border-[var(--border-1)]">
                    {DAYS.map((d) => (
                      <div
                        key={d}
                        className="px-2 py-2 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-4)] font-mono text-center"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  <div>
                    {weeks.map(({ days, start: weekStart }, wi) => {
                      const spanningEvents = multiDayEventsForWeek(weekStart);
                      return (
                        <div key={wi} className="border-b border-[var(--border-1)] last:border-b-0">
                          {spanningEvents.length > 0 && (
                            <div
                              className="grid grid-cols-7 border-b border-[var(--border-1)]"
                              style={{ gridAutoRows: "20px" }}
                            >
                              {layoutMultiDayLanes(spanningEvents, weekStart).map((lane, li) =>
                                lane.map((evt) => {
                                  const span = visibleSpan(evt, weekStart);
                                  if (!span) return null;
                                  const color = EVENT_COLORS[evt.colorId ?? ""];
                                  const start = new Date(evt.start);
                                  const end = eventEndInclusive(evt);
                                  const isStartVisible = dayStart(start) >= dayStart(weekStart);
                                  const isEndVisible = dayStart(end) < addDays(dayStart(weekStart), 7);
                                  return (
                                    <button
                                      key={evt.id}
                                      onClick={() => openEdit(evt)}
                                      className="text-[10px] font-medium truncate px-1.5 py-0.5 text-left hover:opacity-90 transition-opacity m-0.5"
                                      style={{
                                        gridColumn: `${span.startCol + 1} / ${span.endCol + 2}`,
                                        gridRow: li + 1,
                                        backgroundColor: color?.bg ?? "var(--accent)",
                                        color: color?.fg ?? "var(--text-1)",
                                        borderRadius: `${isStartVisible ? "4px" : "0"} ${isEndVisible ? "4px" : "0"} ${isEndVisible ? "4px" : "0"} ${isStartVisible ? "4px" : "0"}`,
                                      }}
                                    >
                                      {isStartVisible ? evt.summary : "\u00A0"}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-7">
                            {days.map((day, di) => {
                              const dayEvents = day ? timedEventsForDay(day) : [];
                              const isToday = day !== null && new Date(year, month, day).toDateString() === todayStr;
                              return (
                                <div
                                  key={di}
                                  onDoubleClick={() => day !== null && createNewEvent(day)}
                                  className={cn(
                                    "min-h-[90px] p-1.5 border-r border-[var(--border-1)] last:border-r-0 transition-colors",
                                    day === null ? "bg-[var(--surface-2)]/30" : "hover:bg-[var(--surface-2)]/50 cursor-pointer"
                                  )}
                                >
                                  {day !== null && (
                                    <>
                                      <span
                                        className={cn(
                                          "inline-flex items-center justify-center w-5 h-5 text-[10px] font-mono rounded-full",
                                          isToday
                                            ? "bg-[var(--accent)] text-[#0a0a0b] font-semibold"
                                            : "text-[var(--text-3)]"
                                        )}
                                      >
                                        {day}
                                      </span>
                                      <div className="mt-1 space-y-0.5">
                                        {dayEvents.map((evt) => {
                                          const color = EVENT_COLORS[evt.colorId ?? ""];
                                          return (
                                            <button
                                              key={evt.id}
                                              onClick={() => openEdit(evt)}
                                              className="w-full text-left px-1.5 py-0.5 rounded text-[9px] font-medium truncate block hover:opacity-80 transition-opacity border border-transparent hover:border-[var(--border-2)]"
                                              style={{
                                                backgroundColor: "transparent",
                                                color: "var(--text-1)",
                                                borderLeftColor: color?.bg ?? "var(--accent)",
                                                borderLeftWidth: "3px",
                                              }}
                                            >
                                              <span className="text-[var(--text-3)] font-mono mr-1">
                                                {formatTime(evt.start)}
                                              </span>
                                              {evt.summary}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {!loading && events?.length === 0 && (
            <div className="mt-6">
              <EmptyState
                icon={<ExternalLink className="w-5 h-5" />}
                title="Aucun événement"
                description="Ton calendrier est vide pour ce mois."
              />
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-1)]">
              <h3 className="text-[14px] font-semibold text-[var(--text-1)]">
                {isCreating ? "Nouvel événement" : "Modifier l'événement"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1.5">
                  Titre
                </label>
                <input
                  type="text"
                  value={editForm.summary}
                  onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="Titre de l'événement"
                  className="w-full h-9 px-3 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                />
              </div>

              {isCreating && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1.5">
                      Début
                    </label>
                    <input
                      type="datetime-local"
                      value={toDatetimeLocal(editing.start)}
                      onChange={(e) => setEditing((evt) => (evt ? { ...evt, start: new Date(e.target.value).toISOString() } : null))}
                      className="w-full h-9 px-3 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] text-[13px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1.5">
                      Fin
                    </label>
                    <input
                      type="datetime-local"
                      value={toDatetimeLocal(editing.end)}
                      onChange={(e) => setEditing((evt) => (evt ? { ...evt, end: new Date(e.target.value).toISOString() } : null))}
                      className="w-full h-9 px-3 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] text-[13px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1.5">
                  Lieu
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Salle, lien, adresse…"
                  className="w-full h-9 px-3 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1.5">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-2">
                  Couleur
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(EVENT_COLORS).map(([id, c]) => (
                    <button
                      key={id}
                      onClick={() => setEditForm((f) => ({ ...f, colorId: id }))}
                      title={c.name}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all duration-200",
                        editForm.colorId === id
                          ? "border-[var(--text-1)] scale-110"
                          : "border-transparent hover:scale-110"
                      )}
                      style={{ backgroundColor: c.bg }}
                    />
                  ))}
                  <button
                    onClick={() => setEditForm((f) => ({ ...f, colorId: "" }))}
                    title="Aucune couleur"
                    className={cn(
                      "w-8 h-8 rounded-full border-2 border-dashed transition-all duration-200 flex items-center justify-center text-[9px]",
                      !editForm.colorId
                        ? "border-[var(--text-1)] scale-110"
                        : "border-[var(--border-2)] hover:scale-110"
                    )}
                    style={{ backgroundColor: "var(--surface-2)" }}
                  >
                    <X className="w-3 h-3 text-[var(--text-3)]" />
                  </button>
                </div>
              </div>

              {editing.start && (
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-3)] font-mono pt-2 border-t border-[var(--border-1)]">
                  <span>{new Date(editing.start).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
                  {!isAllDay(editing) && (
                    <span>{formatTime(editing.start)} — {formatTime(editing.end)}</span>
                  )}
                  {isAllDay(editing) && (
                    <span>Journée entière</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-1)]">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                onClick={handleSave}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
