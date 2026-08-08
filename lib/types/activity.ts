export type ActivityAction =
  | "accreditation_created"
  | "accreditation_updated"
  | "accreditation_deleted"
  | "shoot_created"
  | "shoot_updated"
  | "shoot_deleted"
  | "concert_created"
  | "concert_updated"
  | "concert_deleted"
  | "reminder_created"
  | "reminder_updated"
  | "reminder_deleted"
  | "watch_later_added"
  | "watch_later_read"
  | "watch_later_deleted"
  | "memory_added"
  | "memory_updated"
  | "memory_deleted"
  | "email_sent"
  | "email_triaged"
  | "calendar_event_created"
  | "leetcode_solved"
  | "chat_message_sent"
  | "login"
  | "logout";

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  label: string;
  details?: string;
  createdAt: string;
}

export interface ActivityData {
  entries: ActivityEntry[];
}
