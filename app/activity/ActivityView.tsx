"use client";

import { useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { cn } from "@/lib/utils";
import { loadActivity } from "@/app/actions/activity";
import type { ActivityEntry, ActivityAction } from "@/lib/types";

const ACTION_LABELS: Partial<Record<ActivityAction, string>> = {
  accreditation_created: "Accréditation créée",
  accreditation_updated: "Accréditation mise à jour",
  accreditation_deleted: "Accréditation supprimée",
  concert_updated: "Concerts mis à jour",
  reminder_created: "Rappel créé",
  reminder_updated: "Rappel modifié",
  reminder_deleted: "Rappel supprimé",
  watch_later_added: "Ajouté à voir plus tard",
  watch_later_deleted: "Retiré de à voir plus tard",
  memory_added: "Fait mémorisé",
  memory_updated: "Fait modifié",
  memory_deleted: "Fait supprimé",
  leetcode_solved: "Exercice LeetCode résolu",
};

const ACTION_COLORS: Partial<Record<ActivityAction, string>> = {
  accreditation_created: "text-[var(--accent)]",
  accreditation_updated: "text-[var(--warm)]",
  accreditation_deleted: "text-[var(--danger)]",
  reminder_created: "text-[var(--accent)]",
  reminder_updated: "text-[var(--warm)]",
  reminder_deleted: "text-[var(--danger)]",
  watch_later_added: "text-[var(--accent)]",
  watch_later_deleted: "text-[var(--danger)]",
  memory_added: "text-[var(--success)]",
  memory_updated: "text-[var(--warm)]",
  memory_deleted: "text-[var(--danger)]",
  leetcode_solved: "text-[var(--success)]",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function groupByDate(entries: ActivityEntry[]): Map<string, ActivityEntry[]> {
  const groups = new Map<string, ActivityEntry[]>();
  for (const e of entries) {
    const key = new Date(e.createdAt).toLocaleDateString("fr-FR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const existing = groups.get(key) ?? [];
    existing.push(e);
    groups.set(key, existing);
  }
  return groups;
}

export function ActivityView({ entries: initial }: { entries: ActivityEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const fresh = await loadActivity(50);
    setEntries(fresh);
    setLoading(false);
  }

  const groups = groupByDate(entries);

  return (
    <AppShell>
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 overflow-y-auto p-6">
        <PageHeader
          eyebrow="Historique"
          title="Journal d'activité"
          description="Toutes les actions récentes dans PersonalBrain"
          actions={
            <button
              onClick={refresh}
              disabled={loading}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] border border-[var(--border-1)] transition-colors"
              title="Rafraîchir"
            >
              <RotateCcw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
          }
        />

        {entries.length === 0 ? (
          <EmptyState
            icon={<History className="w-5 h-5" />}
            title="Aucune activité"
            description="Les actions que tu effectues apparaîtront ici."
          />
        ) : (
          <div className="space-y-8">
            {Array.from(groups.entries()).map(([date, dayEntries]) => (
              <section key={date}>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-4)] font-mono mb-3 px-1">
                  {date}
                </h3>
                <div className="space-y-0.5">
                  {dayEntries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[var(--surface-2)]/50 transition-colors"
                    >
                      <span className={cn(
                        "mt-0.5 w-1.5 h-1.5 rounded-full shrink-0",
                        e.action.includes("deleted") ? "bg-[var(--danger)]" :
                        e.action.includes("created") || e.action.includes("added") || e.action.includes("solved") ? "bg-[var(--accent)]" :
                        "bg-[var(--warm)]"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[var(--text-1)] truncate">
                          <span className={cn("font-medium", ACTION_COLORS[e.action] ?? "")}>
                            {ACTION_LABELS[e.action] ?? e.action}
                          </span>
                          {" — "}
                          {e.label}
                        </p>
                        {e.details && (
                          <p className="text-[10px] text-[var(--text-4)] font-mono mt-0.5 truncate">{e.details}</p>
                        )}
                      </div>
                      <time className="text-[10px] text-[var(--text-4)] font-mono shrink-0 pt-0.5">
                        {formatTime(e.createdAt)}
                      </time>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
