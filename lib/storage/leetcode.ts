import type { LeetcodeData, LeetcodeExercise } from "../types";
import { maybeBackup, mutateJson, readOrCreate, writeJsonAtomic } from "../storage-core";

const defaultLeetcode: LeetcodeData = {
  streak: 0,
  history: [],
  exercises: [],
};

export async function getLeetcode(): Promise<LeetcodeData> {
  return readOrCreate("leetcode.json", defaultLeetcode);
}

export async function saveLeetcode(data: LeetcodeData): Promise<void> {
  await maybeBackup("leetcode.json");
  return writeJsonAtomic("leetcode.json", data);
}

export async function addLeetcodeExercise(exercise: LeetcodeExercise): Promise<void> {
  await mutateJson<LeetcodeData>("leetcode.json", defaultLeetcode, (data) => {
    data.exercises.unshift(exercise);
    data.history.push({ date: new Date().toISOString(), solved: true });
  });
}
