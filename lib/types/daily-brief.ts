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
