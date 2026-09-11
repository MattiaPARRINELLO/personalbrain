// Barrel : surface publique historique du module ai-providers.
// Les adapteurs OpenAI/Anthropic vivent dans ai-providers/{openai,anthropic}.ts.
import type { ChatCompletionResult, StreamEvent, UnifiedMessage, UnifiedTool } from "./ai-providers/types";
import { isAnthropicModel } from "./ai-providers/config";
import { chatOpenAI, streamOpenAI } from "./ai-providers/openai";
import { chatAnthropic, streamAnthropic } from "./ai-providers/anthropic";

export type { UnifiedMessage, UnifiedTool, UnifiedToolCall, ChatCompletionResult, StreamEvent } from "./ai-providers/types";

export async function chatCompletion(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[],
  signal?: AbortSignal,
  sessionId?: string
): Promise<ChatCompletionResult> {
  if (isAnthropicModel(model)) {
    return chatAnthropic(model, messages, tools, signal, sessionId);
  }
  return chatOpenAI(model, messages, tools, signal, sessionId);
}

export async function* streamChatCompletion(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[],
  signal?: AbortSignal,
  sessionId?: string
): AsyncGenerator<StreamEvent> {
  if (isAnthropicModel(model)) {
    return yield* streamAnthropic(model, messages, tools, signal, sessionId);
  }
  return yield* streamOpenAI(model, messages, tools, signal, sessionId);
}
