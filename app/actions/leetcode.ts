"use server";

import { requireSession } from "@/lib/session";

import { getLeetcode, saveLeetcode, addLeetcodeExercise, logActivity, getCalendar } from "@/lib/storage";
import { fetchLeetCodeProfile } from "@/lib/leetcode-api";
import type { LeetcodeData, LeetcodeExercise, CalendarEvent } from "@/lib/types";
import { findFreeSlots } from "@/lib/leetcode-utils";

export async function loadLeetcode(): Promise<LeetcodeData> {
  await requireSession();
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
  await requireSession();
  await saveLeetcode(data);
}

export async function storeExercise(exercise: LeetcodeExercise): Promise<void> {
  await requireSession();
  await addLeetcodeExercise(exercise);
  await logActivity("leetcode_solved", `Exercice LeetCode : ${exercise.title}`);
}

export async function syncLeetcode(): Promise<LeetcodeData> {
  await requireSession();
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
  await requireSession();
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

export async function setLeetcodeUsername(username: string): Promise<LeetcodeData> {
  await requireSession();
  const cleaned = username.trim();
  if (!cleaned) throw new Error("Username requis");

  const data = await getLeetcode();
  data.leetcodeUsername = cleaned;
  await saveLeetcode(data);

  // Sync immediately
  return syncLeetcode();
}
