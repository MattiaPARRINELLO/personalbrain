import type { Reminder } from "./types";
import {
  createMicrosoftTodoTask,
  updateMicrosoftTodoTask,
  deleteMicrosoftTodoTask,
  getMicrosoftTodoTask,
  getDefaultTodoListId,
  isMicrosoftLinked,
} from "./microsoft-client";
import { updateReminder, deleteReminder, getReminders } from "./storage";
import { invalidateServerCachePattern } from "./server-cache";

// Sync bidirectionnelle backstage ↔ Microsoft To Do pour les rappels créés
// depuis backstage (qui se sync ensuite vers Samsung Reminder).
// Principe : chaque rappel créé localement est lié à une tâche MS
// (microsoftTaskId/microsoftListId). Toute mutation locale est poussée vers MS
// (fire-and-forget), et la réconciliation au chargement de /reminders applique
// les changements faits côté MS (dernier-écrit-gagne, comparé via
// updatedAt local vs lastModifiedDateTime MS).

async function invalidateTodoCache(): Promise<void> {
  invalidateServerCachePattern(/^todo:/);
}

function localTimestamp(r: Reminder): number {
  return r.updatedAt ? new Date(r.updatedAt).getTime() : new Date(r.createdAt).getTime();
}

// ─── Push : local → MS ─────────────────────────────────────────────

export async function pushNewReminderToMicrosoft(reminder: Reminder): Promise<Reminder> {
  if (reminder.microsoftTaskId || !(await isMicrosoftLinked())) return reminder;
  try {
    const listId = await getDefaultTodoListId();
    const task = await createMicrosoftTodoTask(listId, {
      title: reminder.title,
      dueAt: reminder.dueAt,
      notes: reminder.notes,
    });
    const linked = await updateReminder(reminder.id, {
      microsoftTaskId: task.id,
      microsoftListId: listId,
    });
    await invalidateTodoCache();
    return linked ?? reminder;
  } catch (err) {
    console.warn("[reminder-sync] pushNew échoué:", err instanceof Error ? err.message : err);
    return reminder;
  }
}

export async function pushReminderUpdateToMicrosoft(reminder: Reminder): Promise<void> {
  if (!reminder.microsoftTaskId || !reminder.microsoftListId || !(await isMicrosoftLinked())) return;
  try {
    await updateMicrosoftTodoTask(reminder.microsoftListId, reminder.microsoftTaskId, {
      title: reminder.title,
      notes: reminder.notes,
      dueAt: reminder.dueAt,
      status: reminder.status === "done" ? "completed" : reminder.status === "pending" ? "notStarted" : undefined,
    });
    await invalidateTodoCache();
  } catch (err) {
    console.warn("[reminder-sync] pushUpdate échoué:", err instanceof Error ? err.message : err);
  }
}

export async function pushReminderDeleteToMicrosoft(reminder: Reminder): Promise<void> {
  if (!reminder.microsoftTaskId || !reminder.microsoftListId || !(await isMicrosoftLinked())) return;
  try {
    await deleteMicrosoftTodoTask(reminder.microsoftListId, reminder.microsoftTaskId);
    await invalidateTodoCache();
  } catch (err) {
    console.warn("[reminder-sync] pushDelete échoué:", err instanceof Error ? err.message : err);
  }
}

// ─── Réconciliation : MS → local ───────────────────────────────────

export async function reconcileRemindersWithMicrosoft(): Promise<void> {
  if (!(await isMicrosoftLinked())) return;
  const { reminders } = await getReminders();
  const linked = reminders.filter((r) => r.microsoftTaskId && r.microsoftListId);
  if (linked.length === 0) return;

  let changed = false;
  for (const r of linked) {
    try {
      const task = await getMicrosoftTodoTask(r.microsoftListId!, r.microsoftTaskId!);

      // Tâche supprimée côté MS → suppression locale propagée.
      if (!task) {
        await deleteReminder(r.id);
        changed = true;
        continue;
      }

      // Local plus récent (ou égal) : rien à appliquer.
      const msTime = new Date(task.lastModifiedDateTime).getTime();
      if (msTime <= localTimestamp(r)) continue;

      const updates: Partial<Pick<Reminder, "title" | "notes" | "dueAt" | "status">> = {
        title: task.title,
        notes: task.body?.content || undefined,
      };
      if (task.dueDateTime?.dateTime) updates.dueAt = task.dueDateTime.dateTime;
      if (task.status === "completed") {
        updates.status = "done";
      } else if (r.status === "done") {
        updates.status = "pending";
      }

      await updateReminder(r.id, updates);
      changed = true;
    } catch (err) {
      console.warn(
        `[reminder-sync] Réconciliation échouée pour ${r.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (changed) await invalidateTodoCache();
}
