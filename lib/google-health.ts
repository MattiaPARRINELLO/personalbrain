/**
 * État de santé d'un compte Google lié (gmail / calendar).
 *
 * Contexte : pour un projet Google Cloud non vérifié (compte perso,
 * scopes restreints), Google expire les refresh tokens après ~7 jours.
 * On ne peut pas connaître l'échéance exacte à l'avance — on la détecte
 * quand un refresh échoue (invalid_grant) et on l'estime via la date de
 * liaison (TokenExpiry heuristic). Ce module fournit la dérivation pure
 * de cet état ; l'I/O (tokens + marqueur de casse) vit dans
 * lib/google-client.ts.
 */

export type GoogleAccountHealth = {
  linked: boolean;
  /** true si un refresh a échoué (invalid_grant) : il faut reconnecter. */
  broken: boolean;
  /** true si le lien est vieux (proche des 7 j de mode Testing) : reconnecter bientôt. */
  expiringSoon: boolean;
  /** Âge du lien en jours, ou null si inconnu. */
  ageDays: number | null;
};

/** Durée de vie typique d'un refresh token d'app non vérifiée (mode Testing). */
const TESTING_TOKEN_EXPIRY_DAYS = 7;

/** À partir de quel âge du lien on passe en alerte (5,5 jours). */
const WARN_AFTER_DAYS = TESTING_TOKEN_EXPIRY_DAYS - 1.5;

export type GoogleHealthInput = {
  hasRefreshToken: boolean;
  brokenSinceMs: number | null;
  obtainedAtMs: number | null;
  nowMs: number;
};

export function deriveGoogleHealth(input: GoogleHealthInput): GoogleAccountHealth {
  const { hasRefreshToken, brokenSinceMs, obtainedAtMs, nowMs } = input;

  if (!hasRefreshToken) {
    return { linked: false, broken: false, expiringSoon: false, ageDays: null };
  }

  const ageDays =
    obtainedAtMs === null ? null : (nowMs - obtainedAtMs) / 86_400_000;

  return {
    linked: true,
    broken: brokenSinceMs !== null,
    expiringSoon: brokenSinceMs === null && ageDays !== null && ageDays >= WARN_AFTER_DAYS,
    ageDays: ageDays === null ? null : Math.max(0, ageDays),
  };
}