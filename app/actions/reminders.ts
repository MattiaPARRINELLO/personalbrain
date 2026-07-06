"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addReminder,
  deleteReminder,
  getReminders,
  updateReminder,
  logActivity,
} from "@/lib/storage";
import type { Reminder, RemindersData } from "@/lib/types";

const recurrenceSchema = z.enum(["daily", "weekly", "monthly"]);

const createReminderSchema = z.object({
  title: z.string().trim().min(1, "Titre requis"),
  notes: z.string().trim().optional(),
  dueAt: z.string().min(1, "Date d'echeance requise"),
  recurrence: recurrenceSchema.optional(),
});

const reminderStatusSchema = z.enum(["pending", "done", "snoozed"]);

const updateReminderSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    notes: z.string().trim().optional(),
    dueAt: z.string().min(1).optional(),
    status: reminderStatusSchema.optional(),
    recurrence: recurrenceSchema.optional(),
  })
  .strict();

export async function loadReminders(): Promise<RemindersData> {
  return getReminders();
}

export async function createReminder(input: {
  title: string;
  notes?: string;
  dueAt: string;
  recurrence?: Reminder["recurrence"];
}): Promise<Reminder> {
  const parsed = createReminderSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const reminder = await addReminder(parsed.data);
  await logActivity("reminder_created", `Rappel créé : ${reminder.title}`, reminder.dueAt);
  revalidatePath("/reminders");
  return reminder;
}

export async function editReminder(
  id: string,
  updates: Partial<Pick<Reminder, "title" | "notes" | "dueAt" | "status" | "recurrence">>
): Promise<Reminder | null> {
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const parsed = updateReminderSchema.safeParse(updates);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const r = await updateReminder(id, parsed.data);
  if (r) await logActivity("reminder_updated", `Rappel modifié : ${r.title}`, r.status);
  revalidatePath("/reminders");
  return r;
}

export async function removeReminder(id: string): Promise<boolean> {
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const ok = await deleteReminder(id);
  if (ok) await logActivity("reminder_deleted", "Rappel supprimé", id);
  revalidatePath("/reminders");
  return ok;
}

export async function markReminderStatus(
  id: string,
  status: Reminder["status"]
): Promise<Reminder | null> {
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const parsedStatus = reminderStatusSchema.safeParse(status);
  if (!parsedStatus.success) throw new Error("Statut invalide");
  const r = await updateReminder(id, { status: parsedStatus.data });
  revalidatePath("/reminders");
  return r;
}
