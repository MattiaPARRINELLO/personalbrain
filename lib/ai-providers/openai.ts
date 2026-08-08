import OpenAI from "openai";
import type { ChatCompletionResult, StreamEvent, UnifiedMessage, UnifiedTool, UnifiedToolCall } from "./types";
import { getClientConfig, REQUEST_TIMEOUT_MS } from "./config";

export async function chatOpenAI(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[],
  signal?: AbortSignal
): Promise<ChatCompletionResult> {
  const client = new OpenAI(getClientConfig());

  const openaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.tool_call_id ?? "", content: m.content ?? "" };
    }
    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      return {
        role: "assistant",
        content: m.content ?? null,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      };
    }
    return { role: m.role, content: m.content ?? "" };
  });

  const completion = await client.chat.completions.create(
    {
      model,
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 2048,
    },
    { signal, timeout: REQUEST_TIMEOUT_MS }
  );

  const message = completion.choices[0]?.message;
  const content = message?.content ?? "";
  const toolCalls: UnifiedToolCall[] = (message?.tool_calls ?? [])
    .filter((tc) => tc.type === "function")
    .map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

  return { content, toolCalls };
}

export async function* streamOpenAI(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[],
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const client = new OpenAI(getClientConfig());

  const openaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.tool_call_id ?? "", content: m.content ?? "" };
    }
    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      return {
        role: "assistant",
        content: m.content ?? null,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      };
    }
    return { role: m.role, content: m.content ?? "" };
  });

  let stream;
  try {
    stream = await client.chat.completions.create(
      {
        model,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 2048,
        stream: true,
      },
      { signal, timeout: REQUEST_TIMEOUT_MS }
    );
  } catch (err: unknown) {
    const detail = err instanceof Object && "status" in (err as object)
      ? `status=${(err as { status: unknown }).status} message=${err instanceof Error ? err.message : String(err)}`
      : String(err);
    console.error(`[streamOpenAI] ${model} failed:`, detail);
    throw err;
  }

  const toolCalls = new Map<number, { id: string; name: string; args: string }>();
  let fullContent = "";

  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
    const delta = choice?.delta;

    const rc = (delta as Record<string, unknown> | undefined)?.reasoning_content;
    if (typeof rc === "string") {
      yield { type: "reasoning", content: rc };
    }

    if (delta?.content) {
      fullContent += delta.content;
      yield { type: "delta", content: delta.content };
    }

    if (delta?.tool_calls) {
      // Some providers send all tool calls in one chunk with full data,
      // some stream them incrementally. Handle both.
      for (const tc of delta.tool_calls) {
        const existing = toolCalls.get(tc.index);
        if (tc.id) {
          // New or full tool call
          toolCalls.set(tc.index, {
            id: tc.id,
            name: tc.function?.name ?? existing?.name ?? "",
            args: tc.function?.arguments ?? existing?.args ?? "",
          });
        } else if (existing && tc.function?.arguments) {
          existing.args += tc.function.arguments;
        } else if (!existing && tc.function?.name) {
          toolCalls.set(tc.index, {
            id: "",
            name: tc.function.name,
            args: tc.function?.arguments ?? "",
          });
        }
      }
    }

    if (choice?.finish_reason === "tool_calls") {
      for (const [, tc] of toolCalls) {
        yield {
          type: "tool_start",
          toolCallId: tc.id || crypto.randomUUID(),
          name: tc.name,
          arguments: tc.args,
        };
      }
      return;
    }

    if (choice?.finish_reason === "stop") {
      yield { type: "done", content: fullContent };
      return;
    }
  }

  if (fullContent) {
    yield { type: "done", content: fullContent };
  } else {
    yield { type: "done", content: "" };
  }
}
