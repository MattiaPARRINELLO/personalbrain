import type { Reminder, RemindersData } from "../types";
import { maybeBackup, mutateJson, readOrCreate, writeJsonAtomic } from "../storage-core";

const defaultReminders: RemindersData = { reminders: [] };

export async function getReminders(): Promise<RemindersData> {
  return readOrCreate("reminders.json", defaultReminders);
}

export async function saveReminders(data: RemindersData): Promise<void> {
  await maybeBackup("reminders.json");
  return writeJsonAtomic("reminders.json", data);
}

export async function addReminder(input: {
  title: string;
  notes?: string;
  dueAt: string;
  recurrence?: Reminder["recurrence"];
}): Promise<Reminder> {
  const reminder: Reminder = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    title: input.title.trim(),
    notes: input.notes?.trim() || undefined,
    dueAt: input.dueAt,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recurrence: input.recurrence,
  };
  await mutateJson<RemindersData>("reminders.json", defaultReminders, (data) => {
    data.reminders.unshift(reminder);
  });
  return reminder;
}

export async function updateReminder(id: string, updates: Partial<Pick<Reminder, "title" | "notes" | "dueAt" | "status" | "notifiedAt" | "recurrence" | "microsoftTaskId" | "microsoftListId">>): Promise<Reminder | null> {
  let updated: Reminder | null = null;
  await mutateJson<RemindersData>("reminders.json", defaultReminders, (data) => {
    const idx = data.reminders.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    data.reminders[idx] = { ...data.reminders[idx], ...updates, updatedAt: new Date().toISOString() };
    updated = data.reminders[idx];
  });
  return updated;
}

export function computeNextRecurrence(dueAt: string, recurrence: Reminder["recurrence"]): string | null {
  if (!recurrence) return null;
  const d = new Date(dueAt);
  if (isNaN(d.getTime())) return null;
  switch (recurrence) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d.toISOString();
}

export async function deleteReminder(id: string): Promise<boolean> {
  let deleted = false;
  await mutateJson<RemindersData>("reminders.json", defaultReminders, (data) => {
    const before = data.reminders.length;
    data.reminders = data.reminders.filter((r) => r.id !== id);
    deleted = data.reminders.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
}
