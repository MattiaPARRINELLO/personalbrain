"use server";

import { revalidatePath } from "next/cache";
import {
  addReminder,
  deleteReminder,
  getReminders,
  updateReminder,
  logActivity,
} from "@/lib/storage";
import type { Reminder, RemindersData } from "@/lib/types";

export async function loadReminders(): Promise<RemindersData> {
  return getReminders();
}

export async function createReminder(input: {
  title: string;
  notes?: string;
  dueAt: string;
}): Promise<Reminder> {
  if (!input.title?.trim()) throw new Error("Titre requis");
  if (!input.dueAt) throw new Error("Date d'echeance requise");
  const reminder = await addReminder(input);
  await logActivity("reminder_created", `Rappel créé : ${reminder.title}`, reminder.dueAt);
  revalidatePath("/reminders");
  return reminder;
}

export async function editReminder(
  id: string,
  updates: Partial<Pick<Reminder, "title" | "notes" | "dueAt" | "status">>
): Promise<Reminder | null> {
  const r = await updateReminder(id, updates);
  if (r) await logActivity("reminder_updated", `Rappel modifié : ${r.title}`, r.status);
  revalidatePath("/reminders");
  return r;
}

export async function removeReminder(id: string): Promise<boolean> {
  const ok = await deleteReminder(id);
  if (ok) await logActivity("reminder_deleted", "Rappel supprimé", id);
  revalidatePath("/reminders");
  return ok;
}

export async function markReminderStatus(
  id: string,
  status: Reminder["status"]
): Promise<Reminder | null> {
  const r = await updateReminder(id, { status });
  revalidatePath("/reminders");
  return r;
}
