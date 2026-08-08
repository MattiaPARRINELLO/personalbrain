"use client";

import { useCallback, useEffect, useState } from "react";
import { ListTodo, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type MicrosoftTodoList, type MicrosoftTodoTask } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// Panneau des reminders Samsung, synchronisés dans Microsoft To Do puis lus
// via le Microsoft Graph todo API.
export function MicrosoftTodoPanel() {
  const [status, setStatus] = useState<"loading" | "linked" | "unlinked">("loading");
  const [lists, setLists] = useState<MicrosoftTodoList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<MicrosoftTodoTask[] | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTasks = useCallback(async (listId: string) => {
    setTasks(null);
    try {
      const res = await api.todo.tasks(listId);
      setTasks(res.tasks ?? []);
    } catch {
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.microsoftStatus();
        if (cancelled) return;
        if (!s.linked) {
          setStatus("unlinked");
          return;
        }
        setStatus("linked");
        const res = await api.todo.lists();
        if (cancelled) return;
        const l = res.lists ?? [];
        setLists(l);
        // La liste par défaut ("Tâches") est le point d'entrée de la sync Samsung Reminder.
        const preferred = l.find((x) => x.wellknownListName === "tasks") ?? l[0];
        if (preferred) {
          setActiveListId(preferred.id);
          await loadTasks(preferred.id);
        }
      } catch {
        if (!cancelled) setStatus("unlinked");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTasks]);

  const handleSelectList = (id: string) => {
    setActiveListId(id);
    void loadTasks(id);
  };

  const handleToggle = async (task: MicrosoftTodoTask) => {
    if (!activeListId) return;
    const completed = task.status !== "completed";
    setBusy(true);
    try {
      await api.todo.complete(activeListId, task.id, completed);
      setTasks((prev) =>
        (prev ?? []).map((t) =>
          t.id === task.id ? { ...t, status: completed ? "completed" : "notStarted" } : t
        )
      );
    } catch {
      // Erreur silencieuse : l'état local ne change pas, la tâche reste cohérente.
    }
    setBusy(false);
  };

  const pending = (tasks ?? []).filter((t) => t.status !== "completed");
  const doneCount = (tasks ?? []).length - pending.length;

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 mb-3">
        <ListTodo className="w-3.5 h-3.5 text-[var(--text-3)]" />
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-3)] font-mono">
          Microsoft To Do
        </h2>
        <span className="text-[10px] text-[var(--text-4)] font-mono">Samsung Reminder</span>
      </div>

      {status === "loading" && (
        <div className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}

      {status === "unlinked" && (
        <div className="p-4 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40">
          <p className="text-[12px] text-[var(--text-2)]">
            Tes reminders Samsung peuvent être synchronisés dans Microsoft To Do
            (One UI → Reminder → compte Microsoft). Connecte ton compte pour les
            retrouver ici.
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            onClick={() => {
              window.location.href = "/api/auth/microsoft";
            }}
          >
            Connecter Microsoft To Do
          </Button>
        </div>
      )}

      {status === "linked" && (
        <div className="space-y-3">
          {lists.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {lists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleSelectList(l.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-colors",
                    activeListId === l.id
                      ? "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-1)]"
                  )}
                >
                  {l.displayName}
                </button>
              ))}
            </div>
          )}

          {tasks === null ? (
            <div className="space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : pending.length === 0 ? (
            <p className="text-[12px] text-[var(--text-3)]">
              {doneCount > 0 ? "Tout est terminé ✓" : "Aucune tâche dans cette liste."}
            </p>
          ) : (
            <ul className="space-y-2">
              {pending.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40"
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(t)}
                    disabled={busy}
                    className="mt-0.5 shrink-0 text-[var(--text-3)] hover:text-[var(--success)] transition-colors disabled:opacity-40"
                    aria-label={`Terminer : ${t.title}`}
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="min-w-0">
                    <p className="text-[13px] text-[var(--text-1)] break-words">{t.title}</p>
                    {t.dueDateTime && (
                      <p className="text-[11px] text-[var(--text-3)] font-mono mt-0.5">
                        {new Date(t.dueDateTime.dateTime).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
