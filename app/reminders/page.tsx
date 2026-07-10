"use client";

import { useEffect, useState, useTransition, useRef, useMemo } from "react";
import {
  Bell,
  Plus,
  Check,
  Trash2,
  BellRing,
  BellOff,
  Pencil,
  X,
  RotateCcw,
  Clock,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  loadReminders,
  createReminder,
  removeReminder,
  markReminderStatus,
  editReminder,
} from "@/app/actions/reminders";
import type { Reminder, ReminderRecurrence, ReminderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatRelative, toLocalInputValue, fromLocalInputValue, isOverdue } from "@/lib/date";
import {
  fireBrowserNotification,
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermissionState,
} from "@/lib/notifications";

const POLL_INTERVAL_MS = 15_000;

const RECURRENCE_META: Record<ReminderRecurrence, { label: string }> = {
  daily: { label: "Tous les jours" },
  weekly: { label: "Toutes les semaines" },
  monthly: { label: "Tous les mois" },
};

type DayBucket = {
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

function buildTimeline(reminders: Reminder[]): DayBucket[] {
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

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const notifiedRef = useRef<Set<string>>(new Set());
  const toast = useToast();

  useEffect(() => {
    Promise.resolve().then(() => {
      startTransition(async () => {
        const d = await loadReminders();
        setReminders(d.reminders.sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)));
      });
    });
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => setPermission(getNotificationPermission()));
  }, []);

  useEffect(() => {
    if (permission !== "granted" || !reminders) return;
    const id = setInterval(() => {
      const now = Date.now();
      for (const r of reminders) {
        if (r.status !== "pending") continue;
        if (notifiedRef.current.has(r.id)) continue;
        if (new Date(r.dueAt).getTime() <= now) {
          fireBrowserNotification({
            title: `Rappel : ${r.title}`,
            body: r.notes || "Il est temps.",
            tag: r.id,
          });
          notifiedRef.current.add(r.id);
        }
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [permission, reminders]);

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  };

  const handleCreate = (input: { title: string; notes?: string; dueAt: string; recurrence?: ReminderRecurrence }) => {
    startTransition(async () => {
      const r = await createReminder(input);
      setReminders((prev) => [...(prev ?? []), r].sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)));
      setShowAdd(false);
      toast.show({ message: "Rappel créé", tone: "success", duration: 2200 });
    });
  };

  const handleToggle = (r: Reminder) => {
    const next: ReminderStatus = r.status === "done" ? "pending" : "done";
    setReminders((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    void markReminderStatus(r.id, next);
    if (next === "done") {
      toast.show({ message: "Rappel terminé", tone: "success", duration: 1800 });
    }
  };

  const handleDelete = (id: string) => {
    if (!reminders) return;
    const r = reminders.find((x) => x.id === id);
    if (!r) return;
    setReminders((prev) => (prev ?? []).filter((x) => x.id !== id));
    const toastId = toast.show({
      message: `Rappel supprimé : "${r.title.slice(0, 50)}"`,
      tone: "default",
      duration: 5000,
      action: {
        label: "Annuler",
        onClick: () => {
          setReminders((prev) => (prev ? [...prev, r] : prev));
          void createReminder({ title: r.title, notes: r.notes, dueAt: r.dueAt, recurrence: r.recurrence }).then((restored) => {
            setReminders((prev) =>
              prev ? prev.map((x) => (x.id === id ? restored : x)) : prev
            );
            toast.dismiss(toastId);
            toast.show({ message: "Rappel restauré", tone: "success", duration: 2000 });
          });
        },
      },
    });
    void removeReminder(id);
  };

  const handleEdit = (id: string, input: { title: string; notes?: string; dueAt: string; recurrence?: ReminderRecurrence }) => {
    startTransition(async () => {
      const updated = await editReminder(id, input);
      if (updated) {
        setReminders((prev) =>
          (prev ?? []).map((x) => (x.id === id ? updated : x)).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
        );
        toast.show({ message: "Rappel mis à jour", tone: "success", duration: 2000 });
      }
      setEditing(null);
    });
  };

  const timeline = useMemo(() => buildTimeline(reminders ?? []), [reminders]);
  const completed = (reminders ?? []).filter((r) => r.status === "done");

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Notifications natives"
            title="Rappels"
            description="Liste ce que tu dois faire."
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <PermissionPill permission={permission} onRequest={handleRequestPermission} />
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setShowAdd(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Nouveau rappel
                </Button>
              </div>
            }
          />

          {showAdd && (
            <ReminderForm
              onCancel={() => setShowAdd(false)}
              onSubmit={handleCreate}
            />
          )}

          {permission === "unsupported" && (
            <div className="mb-6 p-4 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 text-[12px] text-[var(--text-3)]">
              Les notifications natives ne sont pas supportées sur ce navigateur.
            </div>
          )}

          {reminders === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : timeline.length === 0 && completed.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-5 h-5" />}
              title="Aucun rappel pour l'instant"
              description="Crée un rappel pour recevoir une notification à l'heure dite."
            />
          ) : (
            <div className="relative">
              <div
                aria-hidden
                className="absolute left-[7px] top-0 bottom-0 w-px bg-gradient-to-b from-[var(--border-1)] via-[var(--border-2)] to-transparent"
              />
              <div className="space-y-8">
                {timeline.map((bucket) => (
                  <section key={bucket.key}>
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={cn(
                          "relative z-10 w-[15px] h-[15px] rounded-full border-2",
                          bucket.bucket === "today"
                            ? "border-[var(--accent)] bg-[var(--accent)] shadow-[0_0_0_3px_var(--accent)]/20"
                            : bucket.bucket === "past"
                              ? "border-[var(--danger)] bg-[var(--danger)]"
                              : "border-[var(--border-3)] bg-[var(--surface-2)]"
                        )}
                      />
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-2)] font-mono capitalize">
                        {bucket.label}
                      </h2>
                      <span className="text-[10px] text-[var(--text-4)] font-mono">
                        {bucket.items.length}
                      </span>
                    </div>
                    <ul className="space-y-2 pl-6">
                      {bucket.items.map((r) =>
                        editing === r.id ? (
                          <ReminderForm
                            key={r.id}
                            initial={r}
                            onCancel={() => setEditing(null)}
                            onSubmit={(input) => handleEdit(r.id, input)}
                          />
                        ) : (
                          <ReminderRow
                            key={r.id}
                            reminder={r}
                            onToggle={() => handleToggle(r)}
                            onEdit={() => setEditing(r.id)}
                            onDelete={() => handleDelete(r.id)}
                          />
                        )
                      )}
                    </ul>
                  </section>
                ))}
              </div>

              {completed.length > 0 && (
                <section className="mt-12">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                    <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-3)] font-mono">
                      Terminés
                    </h2>
                    <span className="text-[10px] text-[var(--text-4)] font-mono">{completed.length}</span>
                  </div>
                  <ul className="space-y-2 opacity-60">
                    {completed.map((r) => (
                      <ReminderRow
                        key={r.id}
                        reminder={r}
                        onToggle={() => handleToggle(r)}
                        onEdit={() => setEditing(r.id)}
                        onDelete={() => handleDelete(r.id)}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function PermissionPill({
  permission,
  onRequest,
}: {
  permission: NotificationPermissionState;
  onRequest: () => void;
}) {
  if (permission === "granted") {
    return (
      <Pill tone="success" dot>
        <BellRing className="w-3 h-3" />
        <span className="hidden sm:inline">Notifications actives</span>
      </Pill>
    );
  }
  if (permission === "denied") {
    return (
      <Pill tone="danger" dot>
        <BellOff className="w-3 h-3" />
        <span className="hidden sm:inline">Refusées</span>
      </Pill>
    );
  }
  if (permission === "unsupported") return null;
  return (
    <Button variant="outline" size="sm" onClick={onRequest} leftIcon={<Bell className="w-3.5 h-3.5" />}>
      <span className="hidden sm:inline">Activer</span>
    </Button>
  );
}

function ReminderRow({
  reminder,
  onToggle,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overdue = reminder.status === "pending" && isOverdue(reminder.dueAt);
  return (
    <li
      className={cn(
        "group flex items-start gap-3 p-4 rounded-xl border transition-all duration-200",
        reminder.status === "done"
          ? "border-[var(--border-1)] bg-[var(--surface-1)]/40"
          : overdue
            ? "border-[var(--danger)]/30 bg-[var(--danger)]/5"
            : "border-[var(--border-1)] bg-[var(--surface-1)]/40 hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]/40"
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 mt-0.5",
          reminder.status === "done"
            ? "bg-[var(--success)] border-[var(--success)] text-[#0a0a0b]"
            : "border-[var(--border-2)] hover:border-[var(--accent)]"
        )}
        title={reminder.status === "done" ? "Marquer en attente" : "Marquer comme fait"}
      >
        {reminder.status === "done" && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[14px] leading-snug",
            reminder.status === "done" ? "line-through text-[var(--text-3)]" : "text-[var(--text-1)]"
          )}
        >
          {reminder.title}
        </p>
        {reminder.notes && (
          <p className="text-[12px] text-[var(--text-3)] mt-1 leading-relaxed">{reminder.notes}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Pill tone={overdue ? "danger" : reminder.status === "done" ? "muted" : "accent"} dot>
            <Clock className="w-2.5 h-2.5 mr-0.5" />
            {overdue ? "En retard" : formatRelative(reminder.dueAt)}
          </Pill>
          <span className="text-[10px] text-[var(--text-4)] font-mono hidden sm:inline">
            {new Date(reminder.dueAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          {reminder.recurrence && (
            <span className="text-[10px] text-[var(--text-3)] font-mono uppercase tracking-wider inline-flex items-center gap-1">
              <RotateCcw className="w-2.5 h-2.5" />
              {RECURRENCE_META[reminder.recurrence].label}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors"
          title="Modifier"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
          title="Supprimer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </li>
  );
}

function ReminderForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: Reminder;
  onCancel: () => void;
  onSubmit: (input: { title: string; notes?: string; dueAt: string; recurrence?: ReminderRecurrence }) => void;
}) {
  const defaultDue = useMemo(() => {
    if (initial) return toLocalInputValue(initial.dueAt);
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    return toLocalInputValue(oneHourFromNow.toISOString());
  }, [initial]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dueAt, setDueAt] = useState(defaultDue);
  const [recurrence, setRecurrence] = useState<ReminderRecurrence | undefined>(initial?.recurrence);

  return (
    <div className="mb-6 p-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 fade-in">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] font-mono mb-3">
        {initial ? "Modifier le rappel" : "Nouveau rappel"}
      </p>
      <div className="space-y-2.5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre du rappel"
          autoFocus
          className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13.5px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optionnel)"
          rows={2}
          className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-2)] placeholder:text-[var(--text-3)] outline-none resize-none focus:border-[var(--accent)]/50"
        />
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-[var(--text-3)] font-mono uppercase tracking-wider shrink-0">
            Échéance
          </label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="flex-1 bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[12.5px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50 font-mono"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[11px] text-[var(--text-3)] font-mono uppercase tracking-wider shrink-0">
            Récurrence
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setRecurrence(undefined)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-colors",
                !recurrence
                  ? "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-1)]"
              )}
            >
              Aucune
            </button>
            {(Object.keys(RECURRENCE_META) as ReminderRecurrence[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRecurrence(r)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-colors",
                  recurrence === r
                    ? "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-1)]"
                )}
              >
                {RECURRENCE_META[r].label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-3">
        <Button variant="ghost" size="sm" onClick={onCancel} leftIcon={<X className="w-3.5 h-3.5" />}>
          Annuler
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSubmit({ title, notes: notes || undefined, dueAt: fromLocalInputValue(dueAt), recurrence })}
          disabled={!title.trim() || !dueAt}
          leftIcon={<Check className="w-3.5 h-3.5" />}
        >
          {initial ? "Sauver" : "Créer"}
        </Button>
      </div>
    </div>
  );
}
