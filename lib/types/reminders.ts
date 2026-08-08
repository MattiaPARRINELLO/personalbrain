export type ReminderStatus = "pending" | "done" | "snoozed";

export type ReminderRecurrence = "daily" | "weekly" | "monthly";

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  dueAt: string;
  status: ReminderStatus;
  createdAt: string;
  notifiedAt?: string;
  recurrence?: ReminderRecurrence;
  // Liaison avec la tâche Microsoft To Do créée depuis backstage (sync bidirectionnelle)
  microsoftTaskId?: string;
  microsoftListId?: string;
  // Dernière modification locale (utilisée par la réconciliation avec MS)
  updatedAt?: string;
}

export interface RemindersData {
  reminders: Reminder[];
}
