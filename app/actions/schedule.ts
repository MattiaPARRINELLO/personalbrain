"use server";

/**
 * Emploi du temps CESAR : sync manuelle + lecture pour les pages.
 * Le scheduler (instrumentation) resynchronise automatiquement si périmé (> 6 h).
 */
import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { getSchedule, syncSchedule, logActivity } from "@/lib/storage";
import type { ScheduleCourse, ScheduleData } from "@/lib/types";

export async function getScheduleData(): Promise<ScheduleData> {
  await requireSession();
  return getSchedule();
}

export async function getScheduleCourses(): Promise<ScheduleCourse[]> {
  await requireSession();
  return (await getSchedule()).courses;
}

export async function syncScheduleNow(): Promise<ScheduleData> {
  await requireSession();

  const data = await syncSchedule();
  if (!data.ok) {
    throw new Error(data.error || "Synchronisation CESAR en echec");
  }

  await logActivity(
    "schedule_synced",
    `Emploi du temps synchronise : ${data.courses.length} seances`,
    `source CESAR`
  );
  revalidatePath("/schedule");
  revalidatePath("/today");

  return data;
}
