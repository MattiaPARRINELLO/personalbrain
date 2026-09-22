/**
 * Écran d'accueil du chat — agrégat « état du monde » renvoyé par
 * `getHomeOverview()` (app/actions/home.ts). Lectures locales uniquement.
 */
export interface HomeCourse {
  subject: string;
  room: string;
  teacher: string;
  lessonType: string;
  remote: boolean;
  /** Timestamps ms epoch */
  start: number;
  end: number;
}

export interface HomeReminder {
  title: string;
  dueAt: string;
  late: boolean;
}

export interface HomeOverview {
  /** Prénom du profil mémoire (null si non renseigné). */
  name: string | null;
  /** Cours en cours au moment de l'appel. */
  currentCourse: HomeCourse | null;
  /** Prochain cours qui n'a pas encore commencé (aujourd'hui ou plus tard). */
  nextCourse: HomeCourse | null;
  /** Cours de la journée restants, prochain inclus. */
  laterToday: HomeCourse[];
  /** Rappels en attente échéance aujourd'hui (triés par heure). */
  remindersToday: HomeReminder[];
  /** Nombre de rappels en retard (échéance avant aujourd'hui). */
  remindersLateCount: number;
  /** Relances (intentions) en attente. */
  pendingFollowups: number;
  leetcodeStreak: number;
  leetcodeSolvedToday: boolean;
}
