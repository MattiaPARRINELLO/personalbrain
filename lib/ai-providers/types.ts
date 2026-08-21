export interface UnifiedMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
}

export interface UnifiedTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface UnifiedToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatCompletionResult {
  content: string;
  toolCalls: UnifiedToolCall[];
}

export type StreamEvent =
  | { type: "reasoning"; content: string }
  | { type: "delta"; content: string }
  | { type: "tool_start"; toolCallId: string; name: string; arguments: string }
  | { type: "tool_result"; name: string; result: string }
  | {
      type: "group_confirm";
      id: string;
      summary: string;
      tools: { toolCallId: string; name: string; arguments: string }[];
    }
  | { type: "memory_facts"; facts: { content: string; category: string; confidence: number }[] }
  | { type: "done"; content: string }
  | { type: "error"; message: string };
