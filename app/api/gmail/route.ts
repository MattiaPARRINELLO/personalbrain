import { NextRequest, NextResponse } from "next/server";
import { fetchGmailMessages, sendGmailReply } from "@/lib/google-actions";

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  unread: boolean;
  messageId?: string;
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q") ?? undefined;
    const messages = await fetchGmailMessages(query, 10);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Gmail GET error:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      emailId: string;
      responseText: string;
    };

    const id = await sendGmailReply(body.emailId, body.responseText);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("Gmail POST error:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
