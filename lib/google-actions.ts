import { getGmailClient, getCalendarClient } from "./google-client";
import type { GmailMessage } from "@/app/api/gmail/route";
import type { CalendarEventItem } from "@/app/api/calendar/route";
import type { OAuth2Client } from "google-auth-library";

type GmailHeader = { name?: string; value?: string };
type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessageRaw = {
  id: string;
  threadId: string;
  payload?: {
    headers?: GmailHeader[];
    parts?: GmailPart[];
    body?: { data?: string };
    mimeType?: string;
  };
  labelIds?: string[];
};

type GmailListResponse = {
  messages?: { id: string; threadId: string }[];
  resultSizeEstimate?: number;
};

type CalendarEventRaw = {
  id?: string;
  summary?: string | null;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
  colorId?: string;
};

type CalendarEventsResponse = {
  items?: CalendarEventRaw[];
};

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function encodeEmail(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function extractHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractBody(parts: GmailPart[] | undefined, mimeType: string | undefined, body: { data?: string } | undefined): string {
  if (mimeType === "text/plain" && body?.data) return decodeBase64Url(body.data);
  if (!parts) return "";
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  }
  for (const part of parts) {
    if (part.mimeType === "text/html" && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }
  return "";
}

async function googleFetch<T>(auth: OAuth2Client, url: string, init?: RequestInit): Promise<T> {
  const accessToken = auth.credentials.access_token;
  if (!accessToken) {
    throw new Error("Google access token manquant. Reconnecte ton compte Google.");
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export async function fetchGmailMessages(query?: string, maxResults = 10): Promise<GmailMessage[]> {
  const auth = await getGmailClient();
  const params = new URLSearchParams({
    userId: "me",
    labelIds: "INBOX",
    maxResults: String(maxResults),
  });
  if (query) params.set("q", query);

  const list = await googleFetch<GmailListResponse>(
    auth,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`
  );

  const messages = list.messages ?? [];

  const details = await Promise.all(
    messages.map(async ({ id }) => {
      const msg = await googleFetch<GmailMessageRaw>(
        auth,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`
      );
      const headers = msg.payload?.headers ?? [];
      const from = extractHeader(headers, "From");
      const subject = extractHeader(headers, "Subject");
      const date = extractHeader(headers, "Date");
      const messageId = extractHeader(headers, "Message-ID");
      const snippet = msg.payload ? extractBody(msg.payload.parts, msg.payload.mimeType, msg.payload.body) : "";
      return {
        id: msg.id,
        threadId: msg.threadId,
        from,
        subject,
        date,
        snippet,
        body: snippet,
        unread: !msg.labelIds?.includes("UNREAD"),
        messageId,
      };
    })
  );

  return details;
}

export async function sendGmailReply(emailId: string, responseText: string): Promise<string> {
  const auth = await getGmailClient();

  const original = await googleFetch<GmailMessageRaw>(
    auth,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`
  );

  const headers = original.payload?.headers ?? [];
  const from = extractHeader(headers, "From");
  const subject = extractHeader(headers, "Subject");
  const messageId = extractHeader(headers, "Message-ID");
  const references = extractHeader(headers, "References");
  const threadId = original.threadId ?? "";

  const to = from.match(/<([^>]+)>/ )?.[1] ?? from;
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

  let raw = `To: ${to}\n`;
  raw += `Subject: ${replySubject}\n`;
  if (messageId) raw += `In-Reply-To: ${messageId}\n`;
  if (messageId || references) raw += `References: ${references ? `${references} ` : ""}${messageId}\n`;
  raw += `Content-Type: text/plain; charset="UTF-8"\n\n`;
  raw += responseText;

  const sent = await googleFetch<{ id?: string }>(
    auth,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      body: JSON.stringify({
        threadId,
        raw: encodeEmail(raw),
      }),
    }
  );

  return sent.id ?? "";
}

export async function createGoogleCalendarEvent(
  summary: string,
  start: string,
  end: string,
  location?: string,
  description?: string
): Promise<string> {
  const auth = await getCalendarClient();

  const event = await googleFetch<{ id?: string }>(
    auth,
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      body: JSON.stringify({
        summary,
        start: { dateTime: start },
        end: { dateTime: end },
        location,
        description,
      }),
    }
  );

  return event.id ?? "";
}

export async function updateGoogleCalendarEvent(
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    location?: string;
    colorId?: string;
  }
): Promise<void> {
  const auth = await getCalendarClient();

  await googleFetch<unknown>(
    auth,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    }
  );
}

export async function fetchGoogleCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<CalendarEventItem[]> {
  const auth = await getCalendarClient();

  const params = new URLSearchParams({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
  });

  const events = await googleFetch<CalendarEventsResponse>(
    auth,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`
  );

  return (events.items ?? []).map((evt) => ({
    id: evt.id ?? "",
    summary: evt.summary ?? "(Sans titre)",
    start: evt.start?.dateTime ?? evt.start?.date ?? timeMin,
    end: evt.end?.dateTime ?? evt.end?.date ?? timeMax,
    location: evt.location ?? undefined,
    description: evt.description ?? undefined,
    colorId: evt.colorId ?? undefined,
  }));
}
