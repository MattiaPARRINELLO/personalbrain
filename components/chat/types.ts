export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  name: string;
  arguments?: string;
  result?: string;
  status: "running" | "success" | "error";
  duration?: number;
  resultCount?: number;
};
