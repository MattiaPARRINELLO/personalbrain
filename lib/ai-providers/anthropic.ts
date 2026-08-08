import Anthropic from "@anthropic-ai/sdk";
import type { ChatCompletionResult, StreamEvent, UnifiedMessage, UnifiedTool, UnifiedToolCall } from "./types";
import { getClientConfig, REQUEST_TIMEOUT_MS } from "./config";

function toAnthropicMessages(messages: UnifiedMessage[]): {
  systemParts: string[];
  conversation: Anthropic.MessageParam[];
} {
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
    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      const blocks: Anthropic.Messages.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* keep empty */ }
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: args,
        });
      }
      conversation.push({ role: "assistant", content: blocks });
      continue;
    }
    conversation.push({ role: m.role, content: m.content ?? "" });
  }

  return { systemParts, conversation };
}

export async function* streamAnthropic(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[],
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const client = new Anthropic(getClientConfig());

  const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));

  const { systemParts, conversation } = toAnthropicMessages(messages);

  let stream;
  try {
    stream = await client.messages.create(
      {
        model,
        system: systemParts.join("\n\n"),
        messages: conversation,
        tools: anthropicTools,
        tool_choice: { type: "auto" },
        max_tokens: 2048,
        temperature: 0.7,
        stream: true,
      },
      { signal, timeout: REQUEST_TIMEOUT_MS }
    );
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

export async function chatAnthropic(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[],
  signal?: AbortSignal
): Promise<ChatCompletionResult> {
  const client = new Anthropic(getClientConfig());

  const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));

  const { systemParts, conversation } = toAnthropicMessages(messages);

  const response = await client.messages.create(
    {
      model,
      system: systemParts.join("\n\n"),
      messages: conversation,
      tools: anthropicTools,
      tool_choice: { type: "auto" },
      max_tokens: 2048,
      temperature: 0.7,
    },
    { signal, timeout: REQUEST_TIMEOUT_MS }
  );

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
