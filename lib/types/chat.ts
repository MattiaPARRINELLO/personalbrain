export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  toolCalls?: { id: string; name: string; arguments: string }[];
}

interface ChatSessionMessage {
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
