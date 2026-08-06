import type { GmailMessage, GoogleCalendarEvent as CalendarEvent } from "./types";

export type { GmailMessage, CalendarEvent };

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
  if (!res.ok) {
    // On vérifie res.ok AVANT de parser : une réponse d'erreur non JSON
    // (page HTML 500) ne doit pas lever un SyntaxError qui masque le message.
    let message = `Erreur ${res.status}`;
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data?.error === "string") message = data.error;
    } catch {
      // Corps non JSON : on garde le message par défaut.
    }
    throw new Error(message);
  }
  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
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
    list: (timeMin: string, timeMax: string) =>
      jsonFetch<{ events?: CalendarEvent[]; error?: string }>(
        `/api/calendar?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
      ),
    create: (data: { summary: string; start: string; end: string; description?: string; location?: string }) =>
      jsonFetch<{ success: boolean; id?: string }>("/api/calendar", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (eventId: string, data: { summary?: string; description?: string; location?: string; colorId?: string }) =>
      jsonFetch<{ success: boolean }>("/api/calendar", {
        method: "PATCH",
        body: JSON.stringify({ eventId, ...data }),
      }),
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
      if (!res.ok) {
        let msg = `Erreur ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
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
  | { type: "memory_facts"; facts: { content: string; category: string; confidence: number }[] }
  | { type: "done"; content: string }
  | { type: "error"; message: string };
