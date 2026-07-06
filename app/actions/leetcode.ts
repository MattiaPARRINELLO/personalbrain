"use server";

import { getLeetcode, saveLeetcode, addLeetcodeExercise, logActivity, getCalendar } from "@/lib/storage";
import { fetchLeetCodeProfile } from "@/lib/leetcode-api";
import type { LeetcodeData, LeetcodeExercise, CalendarEvent } from "@/lib/types";

export async function loadLeetcode(): Promise<LeetcodeData> {
  const data = await getLeetcode();
  // Si un username est configuré mais que les données sont vides, tenter un sync auto
  if (data.leetcodeUsername && data.streak === 0) {
    try {
      const synced = await fetchLeetCodeProfile(data.leetcodeUsername);
      await saveLeetcode({
        ...data,
        streak: synced.streak,
        totalSolved: synced.totalSolved,
        easySolved: synced.easySolved,
        mediumSolved: synced.mediumSolved,
        hardSolved: synced.hardSolved,
        ranking: synced.ranking,
      });
      return { ...data, ...synced, leetcodeUsername: data.leetcodeUsername };
    } catch {
      return data;
    }
  }
  return data;
}

export async function saveLeetcodeData(data: LeetcodeData): Promise<void> {
  await saveLeetcode(data);
}

export async function storeExercise(exercise: LeetcodeExercise): Promise<void> {
  await addLeetcodeExercise(exercise);
  await logActivity("leetcode_solved", `Exercice LeetCode : ${exercise.title}`);
}

export async function syncLeetcode(): Promise<LeetcodeData> {
  const data = await getLeetcode();
  const username = data.leetcodeUsername;
  if (!username) throw new Error("Aucun username LeetCode configuré");

  const synced = await fetchLeetCodeProfile(username);
  const updated: LeetcodeData = {
    ...data,
    streak: synced.streak,
    totalSolved: synced.totalSolved,
    easySolved: synced.easySolved,
    mediumSolved: synced.mediumSolved,
    hardSolved: synced.hardSolved,
    ranking: synced.ranking,
  };
  await saveLeetcode(updated);
  return updated;
}

export async function getSmartSuggestion(): Promise<string> {
  const lec = await getLeetcode();
  const calendarEvents = await getCalendar().catch(() => []);
  const now = new Date();
  const todayEvents = calendarEvents.filter((e) => e.date.startsWith(now.toISOString().slice(0, 10)));
  const freeSlots = findFreeSlots(todayEvents, now);

  let difficulty = "Easy";
  let timeMin = 15;
  if (freeSlots.length > 0) {
    const longestFree = Math.max(...freeSlots.map((s) => s.duration));
    if (longestFree >= 60) { difficulty = "Hard"; timeMin = 60; }
    else if (longestFree >= 30) { difficulty = "Medium"; timeMin = 30; }
  }

  const easyCount = lec.easySolved ?? 0;
  const mediumCount = lec.mediumSolved ?? 0;
  const hardCount = lec.hardSolved ?? 0;
  const total = lec.totalSolved ?? 1;

  let suggestion = `Créneau libre détecté (~${timeMin} min) → `;
  if (difficulty === "Easy") suggestion += "Problème Easy recommandé";
  else if (difficulty === "Medium") suggestion += "Problème Medium recommandé";
  else suggestion += "Problème Hard recommandé (1h)";

  suggestion += `\nStreak: ${lec.streak} jours · Résolus: ${total} (E:${easyCount}/M:${mediumCount}/H:${hardCount})`;
  return suggestion;
}

function findFreeSlots(events: CalendarEvent[], now: Date): { start: Date; end: Date; duration: number }[] {
  if (events.length === 0) {
    const end = new Date(now);
    end.setHours(23, 59, 0, 0);
    return [{ start: now, end, duration: (end.getTime() - now.getTime()) / 60000 }];
  }
  const slots: { start: Date; end: Date; duration: number }[] = [];
  const dayStart = new Date(now);
  dayStart.setHours(8, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 0, 0, 0);
  let cursor = now > dayStart ? now : dayStart;
  const sorted = events
    .map((e) => ({ start: new Date(e.date), end: new Date(new Date(e.date).getTime() + 3600000) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const ev of sorted) {
    if (cursor < ev.start) {
      const duration = (ev.start.getTime() - cursor.getTime()) / 60000;
      if (duration >= 15) slots.push({ start: cursor, end: ev.start, duration });
    }
    if (ev.end > cursor) cursor = ev.end;
  }
  if (cursor < dayEnd) {
    const duration = (dayEnd.getTime() - cursor.getTime()) / 60000;
    if (duration >= 15) slots.push({ start: cursor, end: dayEnd, duration });
  }
  return slots;
}

export async function setLeetcodeUsername(username: string): Promise<LeetcodeData> {
  const cleaned = username.trim();
  if (!cleaned) throw new Error("Username requis");

  const data = await getLeetcode();
  data.leetcodeUsername = cleaned;
  await saveLeetcode(data);

  // Sync immediately
  return syncLeetcode();
}
