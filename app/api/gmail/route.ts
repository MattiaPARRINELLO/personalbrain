import { NextRequest, NextResponse } from "next/server";
import { fetchGmailMessages, sendGmailReply } from "@/lib/google-actions";
import { getServerCached, setServerCached, invalidateServerCachePattern } from "@/lib/server-cache";
import { getSession } from "@/lib/session";
import type { Email as GmailMessage } from "@/lib/types";

const GMAIL_LIST_CACHE_KEY = "gmail:list";
const GMAIL_LIST_TTL_MS = 2 * 60 * 1000;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }
  try {
    const query = request.nextUrl.searchParams.get("q") ?? undefined;
    const cacheKey = query ? `${GMAIL_LIST_CACHE_KEY}:${query}` : GMAIL_LIST_CACHE_KEY;

    const cached = getServerCached<{ messages: GmailMessage[] }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const messages = await fetchGmailMessages(query, 10);
    const response = { messages };
    setServerCached(cacheKey, response, GMAIL_LIST_TTL_MS);
    return NextResponse.json(response);
  } catch (err) {
    console.error("Gmail GET error:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      emailId: string;
      responseText: string;
    };

    const id = await sendGmailReply(body.emailId, body.responseText);
    invalidateServerCachePattern(/^gmail:list/);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("Gmail POST error:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
