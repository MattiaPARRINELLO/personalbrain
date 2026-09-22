/**
 * État de santé d'un compte Google lié (gmail / calendar).
 *
 * Contexte historique : pour un projet Google Cloud en mode Testing (non
 * publié), Google expire les refresh tokens après ~7 jours. Depuis que l'app
 * est publiée (mode Production, même non vérifiée), cette limite ne s'applique
 * plus : l'avertissement d'âge est donc désactivé par défaut et ne se réactive
 * qu'en posant GOOGLE_TESTING_EXPIRY=true. Le signal faisant foi reste
 * `broken` (un refresh a réellement échoué avec invalid_grant). Ce module
 * fournit la dérivation pure de cet état ; l'I/O (tokens + marqueur de casse)
 * vit dans lib/google-client.ts.
 */

export type GoogleAccountHealth = {
  linked: boolean;
  /** true si un refresh a échoué (invalid_grant) : il faut reconnecter. */
  broken: boolean;
  /** true si le lien est vieux et proche de la limite Testing : reconnecter bientôt. */
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
  /** true uniquement si le projet Google est en mode Testing (limite ~7 j). */
  testingExpiry?: boolean;
};

export function deriveGoogleHealth(input: GoogleHealthInput): GoogleAccountHealth {
  const { hasRefreshToken, brokenSinceMs, obtainedAtMs, nowMs, testingExpiry } = input;

  if (!hasRefreshToken) {
    return { linked: false, broken: false, expiringSoon: false, ageDays: null };
  }

  const ageDays =
    obtainedAtMs === null ? null : (nowMs - obtainedAtMs) / 86_400_000;

  return {
    linked: true,
    broken: brokenSinceMs !== null,
    expiringSoon:
      testingExpiry === true &&
      brokenSinceMs === null &&
      ageDays !== null &&
      ageDays >= WARN_AFTER_DAYS,
    ageDays: ageDays === null ? null : Math.max(0, ageDays),
  };
}