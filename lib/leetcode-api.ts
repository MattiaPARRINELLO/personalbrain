const API_BASE = "https://alfa-leetcode-api.onrender.com";

interface LeetCodeApiUser {
  username: string;
  ranking: number;
  streak: number;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  submitStats?: {
    acSubmissionNum: { difficulty: string; count: number }[];
  };
}

interface LeetCodeApiCalendar {
  submissionCalendar: string;
  streak: number;
}

export interface LeetCodeSyncData {
  username: string;
  streak: number;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  ranking: number;
}

export async function fetchLeetCodeProfile(username: string): Promise<LeetCodeSyncData> {
  const cleaned = username.trim().toLowerCase();
  if (!cleaned) throw new Error("Nom d'utilisateur LeetCode requis");

  const [userRes, calendarRes] = await Promise.all([
    fetch(`${API_BASE}/${cleaned}`),
    fetch(`${API_BASE}/${cleaned}/calendar`),
  ]);

  if (!userRes.ok) {
    throw new Error(`LeetCode API: ${userRes.status} ${userRes.statusText}`);
  }

  const userData = await userRes.json() as LeetCodeApiUser;

  if (!userData || !userData.username) {
    throw new Error(`Utilisateur LeetCode "${username}" introuvable`);
  }

  const streak = userData.streak ?? 0;

  // Si le streak n'est pas fourni par le profil, essayer via /calendar
  let finalStreak = streak;
  if (finalStreak === 0 && calendarRes.ok) {
    const calendarData = await calendarRes.json() as LeetCodeApiCalendar;
    finalStreak = calendarData.streak ?? 0;
  }

  return {
    username: userData.username,
    streak: finalStreak,
    totalSolved: userData.totalSolved ?? 0,
    easySolved: userData.easySolved ?? 0,
    mediumSolved: userData.mediumSolved ?? 0,
    hardSolved: userData.hardSolved ?? 0,
    ranking: userData.ranking ?? 0,
  };
}
