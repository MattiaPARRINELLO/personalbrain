"use server";

import { getLeetcode, saveLeetcode, addLeetcodeExercise } from "@/lib/storage";
import { fetchLeetCodeProfile } from "@/lib/leetcode-api";
import type { LeetcodeData, LeetcodeExercise } from "@/lib/types";

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

export async function setLeetcodeUsername(username: string): Promise<LeetcodeData> {
  const cleaned = username.trim();
  if (!cleaned) throw new Error("Username requis");

  const data = await getLeetcode();
  data.leetcodeUsername = cleaned;
  await saveLeetcode(data);

  // Sync immediately
  return syncLeetcode();
}
