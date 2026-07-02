import { NextRequest, NextResponse } from "next/server";
import { fetchGoogleCalendarEvents, createGoogleCalendarEvent } from "@/lib/google-actions";

export interface CalendarEventItem {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  colorId?: string;
}

export async function GET() {
  try {
    const events = await fetchGoogleCalendarEvents(30);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("Calendar GET error:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      summary: string;
      start: string;
      end: string;
      description?: string;
      location?: string;
    };

    const id = await createGoogleCalendarEvent(body.summary, body.start, body.end, body.location, body.description);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("Calendar POST error:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
