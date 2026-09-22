/**
 * Emploi du temps CESAR (emineo) — séances normalisées.
 * Récupérées par lib/cesar-client.ts, stockées dans data/schedule.json.
 */
export interface ScheduleCourse {
  /** UUID de la séance côté CESAR (clé anti-doublon notifications) */
  uuid: string;
  subject: string;
  teacher: string;
  /** Salle + bâtiment concatenés, ex. "Salle 10, Batiment principal" */
  room: string;
  /** Timestamps ms epoch */
  start: number;
  end: number;
  /** "Seance de cours", "TP"... */
  lessonType: string;
  /** Séance annulée → non comptée */
  cancelled: boolean;
  remote: boolean;
  description: string;
  group: string;
}

export interface ScheduleData {
  syncedAt: string;
  /** false = dernière sync en échec (données potentiellement périmées) */
  ok: boolean;
  error?: string;
  courses: ScheduleCourse[];
}
