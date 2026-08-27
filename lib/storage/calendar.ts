import type { CalendarEvent, ConcertsData } from "../types";
import { maybeBackup, mutateJson, newId, readJsonSafe } from "../storage-core";
import { defaultConcerts, getConcerts } from "./concerts";

export async function getCalendar(): Promise<CalendarEvent[]> {
  const concerts = await getConcerts();
  const calendarData = await readJsonSafe<{ events: CalendarEvent[] }>("calendar.json", { events: [] });
  return [
    ...concerts.events.map((evt) => ({
      id: evt.id,
      title: `Concert : ${evt.artist}`,
      date: evt.date,
      venue: evt.venue,
      type: "concert" as const,
    })),
    ...calendarData.events,
  ];
}

export async function addCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
  const newEvent: CalendarEvent = {
    ...event,
    id: newId(),
  };

  if (event.type === "concert") {
    await mutateJson<ConcertsData>("concerts.json", defaultConcerts, (data) => {
      data.events.push({
        id: newEvent.id,
        artist: event.title.replace(/^Concert :\s*/i, ""),
        venue: event.venue ?? "",
        date: event.date,
        status: "shooted",
      });
    });
  } else {
    await mutateJson<{ events: CalendarEvent[] }>("calendar.json", { events: [] }, (data) => {
      data.events.push(newEvent);
    });
    await maybeBackup("calendar.json");
  }

  return newEvent;
}
