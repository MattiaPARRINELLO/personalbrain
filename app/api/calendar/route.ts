import { NextRequest, NextResponse } from "next/server";
import { fetchGoogleCalendarEvents, createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from "@/lib/google-actions";
import { getServerCached, setServerCached, invalidateServerCache } from "@/lib/server-cache";
import { safeErrorMessage } from "@/lib/utils";
import type { GoogleCalendarEvent as CalendarEventItem } from "@/lib/types";

export type { CalendarEventItem };

const CALENDAR_LIST_CACHE_KEY = "calendar:list";
const CALENDAR_LIST_TTL_MS = 2 * 60 * 1000;

function isIsoDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

export async function GET(request: NextRequest) {
  try {
    const timeMin = request.nextUrl.searchParams.get("timeMin");
    const timeMax = request.nextUrl.searchParams.get("timeMax");
    if (!timeMin || !timeMax) {
      return NextResponse.json({ error: "timeMin et timeMax requis" }, { status: 400 });
    }
    if (!isIsoDate(timeMin) || !isIsoDate(timeMax)) {
      return NextResponse.json({ error: "timeMin et timeMax doivent être des dates valides" }, { status: 400 });
    }

    const cacheKey = `${CALENDAR_LIST_CACHE_KEY}:${timeMin}:${timeMax}`;
    const cached = getServerCached<{ events: CalendarEventItem[] }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const events = await fetchGoogleCalendarEvents(timeMin, timeMax);
    const response = { events };
    setServerCached(cacheKey, response, CALENDAR_LIST_TTL_MS);
    return NextResponse.json(response);
  } catch (err) {
    console.error("Calendar GET error:", err);
    return NextResponse.json({ error: safeErrorMessage(err) }, { status: 500 });
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
      colorId?: string;
    };

    if (!body.summary?.trim()) {
      return NextResponse.json({ error: "summary requis" }, { status: 400 });
    }
    if (!isIsoDate(body.start) || !isIsoDate(body.end) || new Date(body.end) <= new Date(body.start)) {
      return NextResponse.json({ error: "start et end doivent être des dates valides (end > start)" }, { status: 400 });
    }

    const id = await createGoogleCalendarEvent(body.summary, body.start, body.end, body.location, body.description, body.colorId);
    invalidateServerCache(CALENDAR_LIST_CACHE_KEY);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("Calendar POST error:", err);
    return NextResponse.json({ error: safeErrorMessage(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      eventId: string;
      summary?: string;
      description?: string;
      location?: string;
      colorId?: string;
    };

    if (!body.eventId) {
      return NextResponse.json({ error: "eventId requis" }, { status: 400 });
    }

    await updateGoogleCalendarEvent(body.eventId, {
      summary: body.summary,
      description: body.description,
      location: body.location,
      colorId: body.colorId,
    });

    invalidateServerCache(CALENDAR_LIST_CACHE_KEY);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Calendar PATCH error:", err);
    return NextResponse.json({ error: safeErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { eventId?: string };

    if (!body.eventId) {
      return NextResponse.json({ error: "eventId requis" }, { status: 400 });
    }

    await deleteGoogleCalendarEvent(body.eventId);

    invalidateServerCache(CALENDAR_LIST_CACHE_KEY);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Calendar DELETE error:", err);
    return NextResponse.json({ error: safeErrorMessage(err) }, { status: 500 });
  }
}
