/**
 * Storage emploi du temps : data/schedule.json, alimenté par lib/cesar-client.ts.
 * Lecture pures pour brief / chat / notifications ; sync piloté par le scheduler
 * (stale > 6 h) ou manuellement via l'action syncScheduleNow.
 */
import type { ScheduleCourse, ScheduleData } from "../types/schedule";
import { writeJsonAtomic, readJsonSafe } from "../storage-core";
import { serverLog } from "../logger";

const SCHEDULE_FILE = "schedule.json";
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 h

export function emptySchedule(): ScheduleData {
  return { syncedAt: "", ok: false, courses: [] };
}

export async function getSchedule(): Promise<ScheduleData> {
  return readJsonSafe<ScheduleData>(SCHEDULE_FILE, emptySchedule());
}

export async function getCourses(): Promise<ScheduleCourse[]> {
  return (await getSchedule()).courses;
}

async function saveSchedule(data: ScheduleData): Promise<void> {
  await writeJsonAtomic(SCHEDULE_FILE, data);
}

let syncInFlight: Promise<ScheduleData> | null = null;

/** Synchronise l'EDT depuis CESAR (login HTTP + scraping). Sécurisé contre les appels concurrents. */
export async function syncSchedule(): Promise<ScheduleData> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    try {
      const { fetchCesarSchedule } = await import("../cesar-client");
      const courses = await fetchCesarSchedule();
      if (!courses.length) throw new Error("0 seance recuperee");
      const data: ScheduleData = { syncedAt: new Date().toISOString(), ok: true, courses };
      await saveSchedule(data);
      console.log(`[schedule] Sync OK : ${courses.length} seances`);
      return data;
    } catch (err) {
      void serverLog("schedule", "error", "Sync CESAR en echec", err);
      const prev = await getSchedule();
      const data: ScheduleData = {
        ...prev,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      await saveSchedule(data);
      return data;
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

export async function isScheduleStale(): Promise<boolean> {
  const data = await getSchedule();
  if (!data.courses.length || !data.syncedAt) return true;
  if (!data.ok) return true; // dernier sync en échec → retenter
  return Date.now() - new Date(data.syncedAt).getTime() > MAX_AGE_MS;
}

/** Sync si requis puis retourne les cours (utilisé par les pages). */
export async function ensureSchedule(): Promise<ScheduleData> {
  if (await isScheduleStale()) await syncSchedule();
  return getSchedule();
}

// ── requêtes ───────────────────────────────────────────

export function getCoursesInRange(courses: ScheduleCourse[], fromMs: number, toMs: number): ScheduleCourse[] {
  return courses.filter((c) => c.end > fromMs && c.start < toMs);
}

/** Cours d'une journée ISO "YYYY-MM-DD" (fuseau local du serveur). */
export function getCoursesForDay(courses: ScheduleCourse[], dayIso: string): ScheduleCourse[] {
  const from = new Date(`${dayIso}T00:00:00`).getTime();
  const to = new Date(`${dayIso}T23:59:59.999`).getTime();
  return getCoursesInRange(courses, from, to);
}

/** Séances qui commencent dans les `leadMin` prochaines minutes (fenêtre large d'1 min en arrière). */
export function getCoursesStartingSoon(courses: ScheduleCourse[], leadMin: number, nowMs = Date.now()): ScheduleCourse[] {
  return courses.filter((c) => c.start >= nowMs - 60_000 && c.start <= nowMs + leadMin * 60_000);
}

export function getUpcomingCourses(courses: ScheduleCourse[], nowMs = Date.now()): ScheduleCourse[] {
  return courses.filter((c) => c.end > nowMs);
}

/** Prochain cours, filtrable par matière (recherche insensible casse/accents). */
export function getNextCourse(courses: ScheduleCourse[], subjectPattern?: string, nowMs = Date.now()): ScheduleCourse | null {
  let re: RegExp | null = null;
  if (subjectPattern) {
    const norm = stripAccents(subjectPattern).toLowerCase();
    re = new RegExp(norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, ".*").slice(0, 60), "i");
  }
  const match = (c: ScheduleCourse) => {
    if (c.end <= nowMs) return false;
    if (!re) return true;
    return re.test(stripAccents(c.subject));
  };
  return getUpcomingCourses(courses, nowMs).sort((a, b) => a.start - b.start).find(match) ?? null;
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Format lisible d'un cours pour le chat / brief. */
export function formatCourse(c: ScheduleCourse): string {
  const d = new Date(c.start);
  const end = new Date(c.end);
  const day = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const time = `${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}-${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return `- ${c.subject} — ${day} ${time}${c.room ? ` — ${c.room}` : ""}${c.remote ? " (distanciel)" : ""}${c.teacher ? ` — ${c.teacher}` : ""}`;
}

/** Notified keys helper : clé unique par séance + créneau de notif. */
export function courseNotifKey(c: ScheduleCourse, lead: number): string {
  return `${c.uuid || `${c.subject}-${c.start}`}@${lead}min`;
}
