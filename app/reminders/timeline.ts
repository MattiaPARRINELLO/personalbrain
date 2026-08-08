import type { Reminder, ReminderRecurrence } from "@/lib/types";

export const RECURRENCE_META: Record<ReminderRecurrence, { label: string }> = {
  daily: { label: "Tous les jours" },
  weekly: { label: "Toutes les semaines" },
  monthly: { label: "Tous les mois" },
};

export type DayBucket = {
  key: string;
  label: string;
  reminder: string;
  bucket: "past" | "today" | "future";
  items: Reminder[];
};

function bucketDay(d: Date): "past" | "today" | "future" {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (day.getTime() === t.getTime()) return "today";
  if (day.getTime() < t.getTime()) return "past";
  return "future";
}

export function buildTimeline(reminders: Reminder[]): DayBucket[] {
  const groups = new Map<string, DayBucket>();
  for (const r of reminders) {
    if (r.status === "done") continue;
    const d = new Date(r.dueAt);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!groups.has(dayKey)) {
      const bucket = bucketDay(d);
      const today = new Date();
      const dayLabel =
        bucket === "today"
          ? "Aujourd'hui"
          : bucket === "past"
            ? d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
            : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      const relative =
        bucket === "today"
          ? "maintenant"
          : `${Math.round((d.getTime() - today.setHours(0, 0, 0, 0)) / 86400000)} j`;
      groups.set(dayKey, { key: dayKey, label: dayLabel, reminder: relative, bucket, items: [] });
    }
    groups.get(dayKey)!.items.push(r);
  }
  const list = Array.from(groups.values());
  list.sort((a, b) => {
    const order = { past: 0, today: 1, future: 2 } as const;
    if (order[a.bucket] !== order[b.bucket]) return order[a.bucket] - order[b.bucket];
    return a.key.localeCompare(b.key);
  });
  for (const b of list) b.items.sort((a, c) => +new Date(a.dueAt) - +new Date(c.dueAt));
  return list;
}
