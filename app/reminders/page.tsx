"use client";

import { useEffect, useState, useTransition, useRef, useMemo } from "react";
import {
  Bell,
  Plus,
  Check,
  Trash2,
  BellRing,
  BellOff,
  CalendarClock,
  Pencil,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  loadReminders,
  createReminder,
  removeReminder,
  markReminderStatus,
  editReminder,
} from "@/app/actions/reminders";
import type { Reminder, ReminderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatRelative, toLocalInputValue, fromLocalInputValue, isOverdue } from "@/lib/date";
import {
  fireBrowserNotification,
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermissionState,
} from "@/lib/notifications";

const POLL_INTERVAL_MS = 15_000;

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const notifiedRef = useRef<Set<string>>(new Set());

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

  // Polling: check for due reminders and fire native notifications
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

  const handleCreate = (input: { title: string; notes?: string; dueAt: string }) => {
    startTransition(async () => {
      const r = await createReminder(input);
      setReminders((prev) => [...(prev ?? []), r].sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)));
      setShowAdd(false);
    });
  };

  const handleToggle = (r: Reminder) => {
    const next: ReminderStatus = r.status === "done" ? "pending" : "done";
    startTransition(async () => {
      const updated = await markReminderStatus(r.id, next);
      if (updated) {
        setReminders((prev) => (prev ?? []).map((x) => (x.id === r.id ? updated : x)));
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const ok = await removeReminder(id);
      if (ok) {
        setReminders((prev) => (prev ?? []).filter((x) => x.id !== id));
      }
    });
  };

  const handleEdit = (id: string, input: { title: string; notes?: string; dueAt: string }) => {
    startTransition(async () => {
      const updated = await editReminder(id, input);
      if (updated) {
        setReminders((prev) =>
          (prev ?? []).map((x) => (x.id === id ? updated : x)).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
        );
      }
      setEditing(null);
    });
  };

  const pending = (reminders ?? []).filter((r) => r.status === "pending");
  const completed = (reminders ?? []).filter((r) => r.status === "done");

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Notifications natives"
            title="Rappels"
            description="Liste ce que tu dois faire. Active les notifications de bureau pour recevoir une vraie alerte système quand un rappel arrive à échéance."
            actions={
              <div className="flex items-center gap-2">
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
          ) : (
            <>
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarClock className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-3)] font-mono">
                    En attente
                  </h2>
                  <span className="text-[10px] text-[var(--text-4)] font-mono">{pending.length}</span>
                </div>
                {pending.length === 0 ? (
                  <EmptyState
                    icon={<Bell className="w-5 h-5" />}
                    title="Aucun rappel en attente"
                    description="Crée un rappel pour recevoir une notification à l'heure dite."
                  />
                ) : (
                  <ul className="space-y-2">
                    {pending.map((r) =>
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
                )}
              </section>

              {completed.length > 0 && (
                <section className="mt-10">
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
            </>
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
        Notifications actives
      </Pill>
    );
  }
  if (permission === "denied") {
    return (
      <Pill tone="danger" dot>
        <BellOff className="w-3 h-3" />
        Refusées
      </Pill>
    );
  }
  if (permission === "unsupported") return null;
  return (
    <Button variant="outline" size="md" onClick={onRequest} leftIcon={<Bell className="w-3.5 h-3.5" />}>
      Activer les notifications
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
            {overdue ? "En retard" : formatRelative(reminder.dueAt)}
          </Pill>
          <span className="text-[10px] text-[var(--text-4)] font-mono">
            {new Date(reminder.dueAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
  onSubmit: (input: { title: string; notes?: string; dueAt: string }) => void;
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
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-3">
        <Button variant="ghost" size="sm" onClick={onCancel} leftIcon={<X className="w-3 h-3" />}>
          Annuler
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSubmit({ title, notes: notes || undefined, dueAt: fromLocalInputValue(dueAt) })}
          disabled={!title.trim() || !dueAt}
          leftIcon={<Check className="w-3 h-3" />}
        >
          {initial ? "Sauver" : "Créer"}
        </Button>
      </div>
    </div>
  );
}
