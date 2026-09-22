import type { LeetcodeContest, LeetcodeSubmissions } from "./types";
import { computeStreak, parseSubmissionCalendar } from "./leetcode-utils";

// API communautaire qui relaie le GraphQL public de LeetCode. Elle découpe les
// données en plusieurs routes : les compteurs ne sont PAS sur le profil (ils
// l'étaient il y a longtemps, ce qui a laissé quatre zéros silencieux dans
// l'app) mais sur `/solved`. Toute réponse d'erreur arrive en HTTP 200 avec un
// tableau `errors` : le code HTTP seul ne suffit pas à détecter un utilisateur
// inconnu.
const API_BASE = "https://alfa-leetcode-api.onrender.com";
const TIMEOUT_MS = 12_000;

// LeetCode renvoie ce rang plancher tant que le compte n'a rien résolu de
// classable : l'afficher tel quel donnerait « #5 000 001 ».
export const UNRANKED_RANKING = 5_000_000;

interface ApiErrors {
  errors?: { message?: string }[];
}

interface ApiProfile extends ApiErrors {
  username?: string;
  ranking?: number;
}

interface ApiSolved extends ApiErrors {
  solvedProblem?: number;
  easySolved?: number;
  mediumSolved?: number;
  hardSolved?: number;
  acSubmissionNum?: { difficulty: string; count: number; submissions: number }[];
}

interface ApiCalendar extends ApiErrors {
  activeYears?: number[];
  totalActiveDays?: number;
  submissionCalendar?: string;
}

interface ApiContest extends ApiErrors {
  contestAttend?: number;
  contestRating?: number;
  contestGlobalRanking?: number;
  contestTopPercentage?: number;
  contestBadges?: { name?: string } | null;
}

export interface LeetCodeSyncData {
  username: string;
  streak: number;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  ranking: number;
  totalSubmissions: number;
  submissions: LeetcodeSubmissions;
  contest?: LeetcodeContest;
}

async function fetchJson<T extends ApiErrors>(path: string, missingMessage: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`LeetCode API ${res.status} sur ${path}`);
  const json = (await res.json()) as T;
  if (json.errors?.length) throw new Error(missingMessage);
  return json;
}

export async function fetchLeetCodeProfile(username: string): Promise<LeetCodeSyncData> {
  const cleaned = username.trim().toLowerCase();
  if (!cleaned) throw new Error("Nom d'utilisateur LeetCode requis");

  const notFound = `Utilisateur LeetCode "${cleaned}" introuvable`;
  const [profile, solved, calendar] = await Promise.all([
    fetchJson<ApiProfile>(`/${cleaned}`, notFound),
    fetchJson<ApiSolved>(`/${cleaned}/solved`, notFound),
    fetchJson<ApiCalendar>(`/${cleaned}/calendar`, notFound),
  ]);

  if (!profile.username) throw new Error(notFound);

  const days = parseSubmissionCalendar(calendar.submissionCalendar ?? "");

  // Les soumissions acceptées viennent de `acSubmissionNum` : c'est la seule
  // source fiable du nombre de soumissions, distinct du nombre de problèmes.
  const accepted = (solved.acSubmissionNum ?? []).find((n) => n.difficulty === "All");

  // Le contest est facultatif : un compte sans concours n'en a pas, et son échec
  // ne doit pas priver l'utilisateur de ses statistiques de résolution.
  const contest = await fetchContest(cleaned, notFound);

  return {
    username: profile.username,
    streak: computeStreak(days),
    totalSolved: solved.solvedProblem ?? 0,
    easySolved: solved.easySolved ?? 0,
    mediumSolved: solved.mediumSolved ?? 0,
    hardSolved: solved.hardSolved ?? 0,
    ranking: profile.ranking ?? 0,
    totalSubmissions: accepted?.submissions ?? 0,
    submissions: {
      calendar: days,
      activeYears: calendar.activeYears ?? [],
      totalActiveDays: calendar.totalActiveDays ?? Object.keys(days).length,
    },
    contest,
  };
}

async function fetchContest(username: string, notFound: string): Promise<LeetcodeContest | undefined> {
  const data = await fetchJson<ApiContest>(`/${username}/contest`, notFound).catch(() => null);
  if (!data || !(data.contestAttend ?? 0)) return undefined;
  return {
    attended: data.contestAttend ?? 0,
    rating: Math.round(data.contestRating ?? 0),
    globalRanking: data.contestGlobalRanking ?? 0,
    topPercentage: data.contestTopPercentage ?? 0,
    badge: data.contestBadges?.name || undefined,
  };
}
