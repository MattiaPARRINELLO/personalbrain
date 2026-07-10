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
  difficulty?: "Easy" | "Medium" | "Hard";
  duration?: number;
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

export type MemorySource = "manual" | "tool" | "auto-extract";

export interface MemoryRelationship {
  sourceId: string;
  targetId: string;
  type: string; // e.g. "shoote_au", "est_musicien", "collabore_avec"
  createdAt: string;
}

export interface MemoryFact {
  id: string;
  content: string;
  category: MemoryCategory;
  createdAt: string;
  source?: MemorySource;
  confidence?: number;
  accessCount?: number;
  lastAccessedAt?: string;
}

export interface MemoryData {
  relationships: MemoryRelationship[];
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
  triage?: {
    priority: "urgent" | "normal" | "low";
    needsReply: boolean;
    summary?: string;
  };
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
  summary?: string;
  aiTags?: string[];
  read?: boolean;
}

export interface ConcertPrep {
  weather: string;
  venueInfo: string;
  checklist: string[];
  travelTips: string[];
}

export type GalleryStatus = "shooted" | "selecting" | "editing" | "delivered";

export interface GalleryItem {
  id: string;
  concertId: string;
  title: string;
  totalPhotos: number;
  selectedPhotos: number;
  editedPhotos: number;
  status: GalleryStatus;
  deliveredTo?: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryData {
  items: GalleryItem[];
}

export interface DailyBrief {
  date: string;
  summary: string;
  events: { title: string; type: "concert" | "reminder" }[];
  reminders: { title: string; dueAt: string }[];
  emails: { from: string; subject: string }[];
  generatedAt: string;
  urgentEmails?: { from: string; subject: string }[];
  leetcodeDaily?: { title: string; difficulty: string; url?: string };
  weather?: string;
  concertChecklist?: string[];
}

export interface WatchLaterData {
  items: WatchLaterItem[];
}

export interface Accreditation {
  id: string;
  artist: string;
  venue: string;
  concertDate: string;
  status: "pending" | "sent" | "accepted" | "refused" | "follow-up";
  emailThreadId?: string;
  contactEmail?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccreditationsData {
  accreditations: Accreditation[];
}

export type PhotoShootStatus = "upcoming" | "done" | "on_pc" | "sorted" | "edited" | "exported" | "sent";

export interface PhotoShoot {
  id: string;
  title: string;
  date: string;
  client: string;
  status: PhotoShootStatus;
  galleryLink?: string;
  photosSent?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoShootsData {
  shoots: PhotoShoot[];
}

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

export interface ChatSessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolCalls?: {
    id: string;
    name: string;
    arguments?: string;
    result?: string;
    status?: "running" | "success" | "error";
    duration?: number;
    resultCount?: number;
  }[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatSessionMessage[];
  createdAt: string;
  updatedAt: string;
  context?: "code" | "photo" | "general";
}

export interface ChatHistory {
  sessions: ChatSession[];
}
