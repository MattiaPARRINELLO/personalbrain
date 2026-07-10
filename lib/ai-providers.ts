import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_KEY = process.env.IA_API_KEY;

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
  | { type: "memory_facts"; facts: { content: string; category: string; confidence: number }[] }
  | { type: "done"; content: string }
  | { type: "error"; message: string };

function getClientConfig() {
  if (!API_URL || !API_KEY) {
    throw new Error("NEXT_PUBLIC_API_URL et IA_API_KEY doivent etre configures");
  }
  return { baseURL: API_URL, apiKey: API_KEY };
}

const ANTHROPIC_MODELS = new Set([
  "qwen3.7-max",
  "qwen3.7-plus",
  "qwen3.6-plus",
  "minimax-m3",
  "minimax-m2.7",
  "minimax-m2.5",
]);

function isAnthropicModel(model: string): boolean {
  return ANTHROPIC_MODELS.has(model);
}

export async function chatCompletion(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[]
): Promise<ChatCompletionResult> {
  if (isAnthropicModel(model)) {
    return chatAnthropic(model, messages, tools);
  }
  return chatOpenAI(model, messages, tools);
}

export async function* streamChatCompletion(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[]
): AsyncGenerator<StreamEvent> {
  if (isAnthropicModel(model)) {
    return yield* streamAnthropic(model, messages, tools);
  }
  return yield* streamOpenAI(model, messages, tools);
}

async function chatOpenAI(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[]
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

  const completion = await client.chat.completions.create({
    model,
    messages: openaiMessages,
    tools: openaiTools,
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 2048,
  });

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

async function* streamOpenAI(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[]
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
    stream = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    });
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

async function* streamAnthropic(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[]
): AsyncGenerator<StreamEvent> {
  const client = new Anthropic(getClientConfig());

  const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));

  const systemParts: string[] = [];
  const conversation: Anthropic.MessageParam[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content ?? "");
      continue;
    }
    if (m.role === "tool") {
      conversation.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: m.tool_call_id ?? "",
          content: m.content ?? "",
        }],
      });
      continue;
    }
    conversation.push({ role: m.role, content: m.content ?? "" });
  }

  let stream;
  try {
    stream = await client.messages.create({
      model,
      system: systemParts.join("\n\n"),
      messages: conversation,
      tools: anthropicTools,
      tool_choice: { type: "auto" },
      max_tokens: 2048,
      temperature: 0.7,
      stream: true,
    });
  } catch (err: unknown) {
    const detail = err instanceof Object && "status" in (err as object)
      ? `status=${(err as { status: unknown }).status} message=${err instanceof Error ? err.message : String(err)}`
      : String(err);
    console.error(`[streamAnthropic] ${model} failed:`, detail);
    throw err;
  }

  let fullContent = "";
  let currentToolUse: { id: string; name: string; args: string } | null = null;
  const toolCalls: { id: string; name: string; arguments: string }[] = [];

  for await (const event of stream) {
    if (event.type === "content_block_start") {
      if (event.content_block.type === "tool_use") {
        currentToolUse = {
          id: event.content_block.id,
          name: event.content_block.name,
          args: "",
        };
      }
    }

    if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") {
        fullContent += event.delta.text;
        yield { type: "delta", content: event.delta.text };
      }
      if (event.delta.type === "input_json_delta" && currentToolUse) {
        currentToolUse.args += event.delta.partial_json;
      }
    }

    if (event.type === "content_block_stop" && currentToolUse) {
      try {
        JSON.parse(currentToolUse.args);
      } catch {
        // args may be incomplete, pad to valid JSON
        currentToolUse.args += "}";
      }
      toolCalls.push({
        id: currentToolUse.id,
        name: currentToolUse.name,
        arguments: currentToolUse.args,
      });
      currentToolUse = null;
    }

    if (event.type === "message_delta") {
      if (event.delta.stop_reason === "tool_use") {
        for (const tc of toolCalls) {
          yield {
            type: "tool_start",
            toolCallId: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          };
        }
        return;
      }
      if (event.delta.stop_reason === "end_turn") {
        yield { type: "done", content: fullContent };
        return;
      }
    }
  }

  yield { type: "done", content: fullContent };
}

async function chatAnthropic(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[]
): Promise<ChatCompletionResult> {
  const client = new Anthropic(getClientConfig());

  const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));

  const systemParts: string[] = [];
  const conversation: Anthropic.MessageParam[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content ?? "");
      continue;
    }
    if (m.role === "tool") {
      conversation.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: m.tool_call_id ?? "",
          content: m.content ?? "",
        }],
      });
      continue;
    }
    conversation.push({ role: m.role, content: m.content ?? "" });
  }

  const response = await client.messages.create({
    model,
    system: systemParts.join("\n\n"),
    messages: conversation,
    tools: anthropicTools,
    tool_choice: { type: "auto" },
    max_tokens: 2048,
    temperature: 0.7,
  });

  const textBlocks = response.content.filter((c) => c.type === "text") as Anthropic.TextBlock[];
  const toolBlocks = response.content.filter((c) => c.type === "tool_use") as Anthropic.ToolUseBlock[];

  const content = textBlocks.map((c) => c.text).join("\n");
  const toolCalls: UnifiedToolCall[] = toolBlocks.map((tc) => ({
    id: tc.id,
    name: tc.name,
    arguments: JSON.stringify(tc.input),
  }));

  return { content, toolCalls };
}
