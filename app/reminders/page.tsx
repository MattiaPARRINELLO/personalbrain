"use client";

import { useEffect, useState, useTransition, useRef, useMemo } from "react";
import { Bell, Plus, Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
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
import { MicrosoftTodoPanel } from "@/components/MicrosoftTodoPanel";
import {
  fireBrowserNotification,
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermissionState,
} from "@/lib/notifications";
import { buildTimeline } from "./timeline";
import { PermissionPill } from "./PermissionPill";
import { ReminderRow } from "./ReminderRow";
import { ReminderForm } from "./ReminderForm";

const POLL_INTERVAL_MS = 15_000;

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
                className="absolute left-[7px] top-0 bottom-0 w-px bg-[var(--border-2)]"
              />
              <div className="space-y-8">
                {timeline.map((bucket) => (
                  <section key={bucket.key}>
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={cn(
                          "relative z-10 w-[15px] h-[15px] rounded-full border-2",
                          bucket.bucket === "today"
                            ? "border-[var(--accent)] bg-[var(--accent)]"
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

          <MicrosoftTodoPanel />
        </div>
      </div>
    </AppShell>
  );
}





