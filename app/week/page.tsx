import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { Card, CardBody } from "@/components/ui/Card";
import { getConcerts, getReminders, getIntentions } from "@/lib/storage";
import { fetchGoogleCalendarEvents } from "@/lib/google-actions";
import { CancelIntentionButton } from "./CancelIntention";

type WeekItem = {
  kind: "evenement" | "concert" | "rappel" | "relance";
  label: string;
  detail?: string;
  dueAt: string;
  intentionId?: string;
};

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// Normalise un timestamp (ISO ou date seule) en clé "YYYY-MM-DD", sinon null.
function toDayKey(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadBadge(kind: WeekItem["kind"]): { label: string; cls: string } {
  switch (kind) {
    case "evenement":
      return { label: "ÉVÉNEMENT", cls: "text-[var(--accent-cool)] border-[var(--accent-cool)]/30 bg-[var(--accent-cool)]/5" };
    case "concert":
      return { label: "CONCERT", cls: "text-[var(--accent-warm)] border-[var(--accent-warm)]/30 bg-[var(--accent-warm)]/5" };
    case "rappel":
      return { label: "RAPPEL", cls: "text-[var(--warm)] border-[var(--warm)]/30 bg-[var(--warm)]/5" };
    case "relance":
      return { label: "RELANCE", cls: "text-[var(--success)] border-[var(--success)]/30 bg-[var(--success)]/5" };
  }
}

function chargeLabel(count: number): { text: string; cls: string } {
  if (count === 0) return { text: "libre", cls: "text-[var(--text-4)]" };
  if (count <= 2) return { text: "léger", cls: "text-[var(--success)]" };
  if (count <= 4) return { text: "moyen", cls: "text-[var(--accent-warm)]" };
  return { text: "chargé", cls: "text-[var(--danger)]" };
}

export default async function WeekPage() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const days: { key: string; date: Date }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    days.push({ key: toDayKey(d.toISOString())!, date: d });
  }

  const itemsByDay = new Map<string, WeekItem[]>();
  for (const d of days) itemsByDay.set(d.key, []);

  // Événements Google Calendar (compte optionnellement lié)
  try {
    const events = await fetchGoogleCalendarEvents(
      days[0].date.toISOString(),
      new Date(days[6].date.getTime() + 86400000).toISOString()
    );
    for (const e of events) {
      const key = toDayKey(e.start);
      const list = key ? itemsByDay.get(key) : undefined;
      if (list) {
        list.push({
          kind: "evenement",
          label: e.summary,
          detail: e.location ? `@ ${e.location}` : undefined,
          dueAt: e.start,
        });
      }
    }
  } catch {
    // Compte Google non lié ou erreur : on affiche le reste sans événements.
  }

  // Concerts (calendrier local)
  try {
    const concerts = await getConcerts();
    for (const c of concerts.events) {
      const key = toDayKey(c.date);
      const list = key ? itemsByDay.get(key) : undefined;
      if (list) {
        list.push({ kind: "concert", label: c.artist, detail: c.venue, dueAt: c.date });
      }
    }
  } catch {
    // Ignoré : données locales absentes.
  }

  // Rappels
  try {
    const reminders = await getReminders();
    for (const r of reminders.reminders) {
      if (r.status !== "pending") continue;
      const key = toDayKey(r.dueAt);
      const list = key ? itemsByDay.get(key) : undefined;
      if (list) {
        list.push({ kind: "rappel", label: r.title, detail: r.notes, dueAt: r.dueAt });
      }
    }
  } catch {
    // Ignoré.
  }

  // Relances IA programmées (en attente)
  try {
    const { intentions } = await getIntentions();
    for (const it of intentions) {
      if (it.status !== "pending") continue;
      const key = toDayKey(it.dueAt);
      const list = key ? itemsByDay.get(key) : undefined;
      if (list) {
        list.push({
          kind: "relance",
          label: it.subject,
          detail: it.message,
          dueAt: it.dueAt,
          intentionId: it.id,
        });
      }
    }
  } catch {
    // Ignoré.
  }

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Les 7 prochains jours"
            title="Semaine"
            description="Ta charge, d'un coup d'œil : événements, concerts, rappels et relances."
          />

          <div className="space-y-4">
            {days.map(({ key, date }, idx) => {
              const items = (itemsByDay.get(key) ?? []).sort((a, b) =>
                a.dueAt.localeCompare(b.dueAt)
              );
              const charge = chargeLabel(items.length);
              const isToday = idx === 0;
              return (
                <Card key={key}>
                  <CardBody>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--text-1)]">
                          {isToday ? "Aujourd'hui" : DAY_NAMES[date.getDay()]}
                        </p>
                        <p className="text-[11px] text-[var(--text-3)] font-mono uppercase tracking-wider">
                          {date.getDate()} {MONTH_NAMES[date.getMonth()]}
                        </p>
                      </div>
                      <span className={`text-[10px] font-mono uppercase tracking-wider ${charge.cls}`}>
                        {charge.text} · {items.length} élément{items.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    {items.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-4)] font-mono">
                        — rien de prévu —
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {items.map((item, i) => {
                          const badge = loadBadge(item.kind);
                          const time = toDayKey(item.dueAt) === key ? new Date(item.dueAt) : null;
                          return (
                            <li
                              key={`${item.kind}-${i}`}
                              className="flex items-start gap-2.5 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]/40 px-3 py-2"
                            >
                              <span
                                className={`shrink-0 mt-0.5 text-[9px] font-mono uppercase tracking-wider border rounded px-1.5 py-0.5 ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12.5px] text-[var(--text-1)] truncate">{item.label}</p>
                                {item.detail && (
                                  <p className="text-[11px] text-[var(--text-3)] truncate">{item.detail}</p>
                                )}
                                {time && !Number.isNaN(time.getTime()) && (
                                  <p className="text-[10px] font-mono text-[var(--text-4)] mt-0.5">
                                    {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                )}
                              </div>
                              {item.kind === "relance" && item.intentionId && (
                                <CancelIntentionButton id={item.intentionId} />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
