export type GmailMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  unread: boolean;
  messageId?: string;
};

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  colorId?: string;
};

export type GoogleLinkStatus = {
  gmail: boolean;
  calendar: boolean;
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string")
        ? (data as { error: string }).error
        : `Erreur ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  googleStatus: () => jsonFetch<GoogleLinkStatus>("/api/auth/google/status"),

  gmail: {
    list: (query?: string) => {
      const qs = query ? `?q=${encodeURIComponent(query)}` : "";
      return jsonFetch<{ messages?: GmailMessage[]; error?: string }>(`/api/gmail${qs}`);
    },
    send: (emailId: string, responseText: string) =>
      jsonFetch<{ success: boolean; id: string }>("/api/gmail", {
        method: "POST",
        body: JSON.stringify({ emailId, responseText }),
      }),
  },

  calendar: {
    list: () => jsonFetch<{ events?: CalendarEvent[]; error?: string }>("/api/calendar"),
  },

  chat: {
    stream: async (
      messages: { role: "user" | "assistant"; content: string }[],
      onEvent: (event: ChatStreamEvent) => void,
      signal?: AbortSignal
    ) => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, model: "general" }),
        credentials: "same-origin",
        signal,
      });
      if (!res.body) throw new Error("Reponse vide du serveur");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            const event = JSON.parse(payload) as ChatStreamEvent;
            onEvent(event);
          } catch {
            // skip malformed
          }
        }
      }
    },
  },
};

export type ChatStreamEvent =
  | { type: "reasoning"; content: string }
  | { type: "delta"; content: string }
  | { type: "tool_start"; toolCallId: string; name: string; arguments: string }
  | { type: "tool_result"; name: string; result: string }
  | { type: "done"; content: string }
  | { type: "error"; message: string };
