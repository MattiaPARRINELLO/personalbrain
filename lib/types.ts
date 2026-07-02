export interface ConcertEvent {
  id: string;
  artist: string;
  venue: string;
  date: string;
  status: "shooted" | "selecting" | "editing" | "delivered";
}

export interface ConcertsData {
  events: ConcertEvent[];
}

export interface LeetcodeExercise {
  id: string;
  title: string;
  code: string;
  response: string;
  createdAt: string;
}

export interface LeetcodeData {
  streak: number;
  history: { date: string; solved: boolean }[];
  exercises: LeetcodeExercise[];
  leetcodeUsername?: string;
  totalSolved?: number;
  easySolved?: number;
  mediumSolved?: number;
  hardSolved?: number;
  ranking?: number;
}

export type MemoryCategory = "dev" | "photo" | "life" | "preference";

export interface MemoryFact {
  id: string;
  content: string;
  category: MemoryCategory;
  createdAt: string;
}

export interface MemoryData {
  profile: {
    name: string;
    preferences: string[];
  };
  facts: MemoryFact[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  venue?: string;
  type: "concert" | "meeting" | "other";
}

export interface Email {
  id: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  unread: boolean;
}

export interface EmailsData {
  emails: Email[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  toolCalls?: { id: string; name: string; arguments: string }[];
}

export type ReminderStatus = "pending" | "done" | "snoozed";

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  dueAt: string;
  status: ReminderStatus;
  createdAt: string;
  notifiedAt?: string;
}

export interface RemindersData {
  reminders: Reminder[];
}

export type WatchLaterCategory = "video" | "article" | "photo" | "music" | "other";

export interface WatchLaterItem {
  id: string;
  url: string;
  title: string;
  description?: string;
  thumbnail?: string;
  source: string;
  category: WatchLaterCategory;
  createdAt: string;
}

export interface WatchLaterData {
  items: WatchLaterItem[];
}
