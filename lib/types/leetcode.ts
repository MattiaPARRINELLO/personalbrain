export interface LeetcodeExercise {
  id: string;
  title: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  duration?: number;
  code: string;
  response: string;
  createdAt: string;
}

/** Calendrier des soumissions acceptées : seuls les jours actifs sont présents. */
export interface LeetcodeSubmissions {
  /** Jour `YYYY-MM-DD` → nombre de soumissions acceptées ce jour-là. */
  calendar: Record<string, number>;
  activeYears: number[];
  totalActiveDays: number;
}

export interface LeetcodeContest {
  attended: number;
  rating: number;
  globalRanking: number;
  topPercentage: number;
  badge?: string;
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
  totalSubmissions?: number;
  submissions?: LeetcodeSubmissions;
  contest?: LeetcodeContest;
  /** Date du dernier sync réussi : pilote le TTL de 30 min. */
  syncedAt?: string;
  /**
   * Dernier échec de sync. Jamais persisté : `loadLeetcode()` le remet à zéro à
   * chaque lecture pour que l'interface ne montre jamais une panne périmée.
   */
  syncError?: string;
}
