"use server";

import { requireSession } from "@/lib/session";
import {
  getCourses,
  getCoursesInRange,
  getLeetcode,
  getMemory,
  getReminders,
  listPendingIntentions,
} from "@/lib/storage";
import type { HomeCourse, HomeOverview, ScheduleCourse } from "@/lib/types";

function toHomeCourse(c: ScheduleCourse): HomeCourse {
  return {
    subject: c.subject,
    room: c.room,
    teacher: c.teacher,
    lessonType: c.lessonType,
    remote: c.remote,
    start: c.start,
    end: c.end,
  };
}

function localDayBounds(now: Date): { start: number; end: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

function localDayIso(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Agrégat « état du monde » pour l'écran d'accueil du chat.
 *
 * Uniquement des lectures de fichiers locaux : Gmail, CESAR et Microsoft To Do
 * restent hors de ce chemin pour ne pas ajouter de latence à l'affichage. Les
 * données distantes (agenda Google, mails) sont lues côté client depuis le
 * cache partagé des widgets.
 */
export async function getHomeOverview(): Promise<HomeOverview> {
  await requireSession();

  const now = new Date();
  const nowMs = now.getTime();
  const { start, end } = localDayBounds(now);

  const [memory, schedule, reminders, intentions, leetcode] = await Promise.all([
    getMemory(),
    getCourses(),
    getReminders(),
    listPendingIntentions(),
    getLeetcode(),
  ]);

  // getCoursesInRange ne filtre pas les séances annulées : on les écarte en
  // amont pour ne jamais mettre un cours annulé en avant. `nextCourse` est le
  // prochain cours qui n'a pas encore commencé (le cours en cours a son propre
  // champ, l'accueil les affiche différemment).
  const activeCourses = schedule.filter((c) => !c.cancelled);
  const currentCourse = activeCourses.find((c) => c.start <= nowMs && c.end > nowMs) ?? null;
  const nextCourse =
    activeCourses
      .filter((c) => c.start > nowMs)
      .sort((a, b) => a.start - b.start)[0] ?? null;
  const laterToday = getCoursesInRange(activeCourses, start, end)
    .filter((c) => c.start > nowMs)
    .sort((a, b) => a.start - b.start);

  // Jours suivants uniquement : `laterToday` couvre déjà le reste de la
  // journée, les deux listes sont donc disjointes.
  const weekEnd = start + 7 * 24 * 60 * 60 * 1000;
  const coursesLater = getCoursesInRange(activeCourses, end + 1, weekEnd).sort(
    (a, b) => a.start - b.start
  );

  const pending = reminders.reminders.filter((r) => r.status === "pending");
  const todayIso = localDayIso(now);
  const late = pending
    .filter((r) => new Date(r.dueAt).getTime() < start)
    .sort((a, b) => +new Date(b.dueAt) - +new Date(a.dueAt));

  return {
    name: memory.profile.name?.trim() || null,
    currentCourse: currentCourse ? toHomeCourse(currentCourse) : null,
    nextCourse: nextCourse ? toHomeCourse(nextCourse) : null,
    laterToday: laterToday.map(toHomeCourse),
    coursesLater: coursesLater.map(toHomeCourse),
    remindersToday: pending
      .filter((r) => {
        const due = new Date(r.dueAt).getTime();
        return due >= start && due <= end;
      })
      .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
      .map((r) => ({ title: r.title, dueAt: r.dueAt, late: new Date(r.dueAt).getTime() < nowMs })),
    remindersLate: late.map((r) => ({ title: r.title, dueAt: r.dueAt, late: true })),
    remindersLateCount: late.length,
    pendingFollowups: intentions.length,
    leetcodeStreak: leetcode.streak ?? 0,
    leetcodeSolvedToday: (leetcode.history ?? []).some(
      (h) => h.date.slice(0, 10) === todayIso && h.solved
    ),
  };
}
