import { google } from "googleapis";
import { getGmailClient, getCalendarClient } from "./google-client";
import type { GmailMessage } from "@/app/api/gmail/route";
import type { CalendarEventItem } from "@/app/api/calendar/route";

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

function extractHeader(headers: { name?: string | null; value?: string | null }[], name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function fetchGmailMessages(query?: string, maxResults = 10): Promise<GmailMessage[]> {
  const auth = await getGmailClient();
  const gmail = google.gmail({ version: "v1", auth });

  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: query,
    labelIds: ["INBOX"],
  });

  const messages = list.data.messages ?? [];

  const details = await Promise.all(
    messages.map(async (msg) => {
      if (!msg.id) return null;
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });
      const payload = full.data.payload;
      const headers = payload?.headers ?? [];
      const from = extractHeader(headers, "From");
      const subject = extractHeader(headers, "Subject");
      const date = extractHeader(headers, "Date");
      const messageId = extractHeader(headers, "Message-ID");
      const snippet = full.data.snippet ?? "";

      let body = "";
      const parts = payload?.parts;
      if (parts) {
        const textPart = parts.find((p) => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          body = decodeBase64Url(textPart.body.data);
        }
      } else if (payload?.body?.data) {
        body = decodeBase64Url(payload.body.data);
      }

      return {
        id: msg.id,
        threadId: msg.threadId ?? "",
        from,
        subject,
        date,
        snippet,
        body: body.slice(0, 1000),
        unread: (full.data.labelIds ?? []).includes("UNREAD"),
        messageId: messageId || undefined,
      };
    })
  );

  return details.filter((d): d is Exclude<typeof d, null> => d !== null);
}

export async function sendGmailReply(emailId: string, responseText: string): Promise<string> {
  const auth = await getGmailClient();
  const gmail = google.gmail({ version: "v1", auth });

  const original = await gmail.users.messages.get({ userId: "me", id: emailId });
  const headers = original.data.payload?.headers ?? [];
  const from = extractHeader(headers, "From");
  const subject = extractHeader(headers, "Subject");
  const messageId = extractHeader(headers, "Message-ID");
  const references = extractHeader(headers, "References");
  const threadId = original.data.threadId ?? "";

  const to = from.match(/<([^>]+)>/ )?.[1] ?? from;
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

  let raw = `To: ${to}\n`;
  raw += `Subject: ${replySubject}\n`;
  if (messageId) raw += `In-Reply-To: ${messageId}\n`;
  if (messageId || references) raw += `References: ${references ? `${references} ` : ""}${messageId}\n`;
  raw += `Content-Type: text/plain; charset="UTF-8"\n\n`;
  raw += responseText;

  const sent = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      threadId,
      raw: encodeEmail(raw),
    },
  });

  return sent.data.id ?? "";
}

export async function createGoogleCalendarEvent(
  summary: string,
  start: string,
  end: string,
  location?: string,
  description?: string
): Promise<string> {
  const auth = await getCalendarClient();
  const calendar = google.calendar({ version: "v3", auth });

  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary,
      description,
      location,
      start: { dateTime: start },
      end: { dateTime: end },
    },
  });

  return event.data.id ?? "";
}

export async function fetchGoogleCalendarEvents(days = 30): Promise<CalendarEventItem[]> {
  const auth = await getCalendarClient();
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const end = new Date();
  end.setDate(now.getDate() + days);

  const events = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });

  return (events.data.items ?? []).map((evt) => ({
    id: evt.id ?? "",
    summary: evt.summary ?? "(Sans titre)",
    start: evt.start?.dateTime ?? evt.start?.date ?? now.toISOString(),
    end: evt.end?.dateTime ?? evt.end?.date ?? now.toISOString(),
    location: evt.location ?? undefined,
    description: evt.description ?? undefined,
    colorId: evt.colorId ?? undefined,
  }));
}
