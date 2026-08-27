type IntentionStatus = "pending" | "done" | "cancelled";

export interface Intention {
  id: string;
  subject: string;
  message?: string;
  dueAt: string;
  status: IntentionStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface IntentionsData {
  intentions: Intention[];
}
