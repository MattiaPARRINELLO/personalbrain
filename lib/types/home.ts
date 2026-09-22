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
  /**
   * Cours des jours suivants (demain → +7 j), disjoint de `laterToday`.
   * Alimente la ligne de temps du panneau de droite.
   */
  coursesLater: HomeCourse[];
  /** Rappels en attente échéance aujourd'hui (triés par heure). */
  remindersToday: HomeReminder[];
  /** Rappels en retard (échéance avant aujourd'hui), du plus récent au plus ancien. */
  remindersLate: HomeReminder[];
  /** Nombre de rappels en retard (échéance avant aujourd'hui). */
  remindersLateCount: number;
  /** Relances (intentions) en attente. */
  pendingFollowups: number;
  leetcodeStreak: number;
  leetcodeSolvedToday: boolean;
  /** Un pseudo LeetCode est enregistré : la puce doit exister même à série 0. */
  leetcodeConfigured: boolean;
}
