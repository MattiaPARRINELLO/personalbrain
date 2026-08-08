export interface LeetcodeExercise {
  id: string;
  title: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  duration?: number;
  code: string;
  response: string;
  createdAt: string;
}

export interface LeetcodeData {
  streak: number;
  history: { date: string; solved: boolean }[];
  exercises: LeetcodeExercise[];
  leetcodeUsername?: string;
  totalSolved?: number;
  easySolved?: number;
  mediumSolved?: number;
  hardSolved?: number;
  ranking?: number;
}
