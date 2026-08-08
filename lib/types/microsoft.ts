// Liste Microsoft To Do (via Microsoft Graph todo API — Samsung Reminder s'y sync)
export interface MicrosoftTodoList {
  id: string;
  displayName: string;
  isOwner?: boolean;
  isShared?: boolean;
  wellknownListName?: string;
}

// Tâche Microsoft To Do (type d'API)
export interface MicrosoftTodoTask {
  id: string;
  title: string;
  status: "notStarted" | "inProgress" | "completed";
  dueDateTime?: { dateTime: string; timeZone: string } | null;
  completedDateTime?: { dateTime: string; timeZone: string } | null;
  createdDateTime: string;
  lastModifiedDateTime: string;
  body?: { contentType: string; content: string };
}
