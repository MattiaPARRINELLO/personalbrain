export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  venue?: string;
  type: "concert" | "meeting" | "other";
}

// Événement du Google Calendar (type d'API, distinct de CalendarEvent local)
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  colorId?: string;
}
