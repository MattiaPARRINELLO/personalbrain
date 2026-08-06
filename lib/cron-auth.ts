/**
 * Authentification des routes cron (/api/cron/*).
 *
 * Les routes cron sont publiques (le middleware les exclut car elles n'ont
 * pas de cookie de session) : elles doivent donc être protégées par un secret
 * partagé. En production, une requête sans secret valide est refusée (401).
 * En développement, l'appel local sans secret est autorisé pour ne pas
 * casser le workflow `bun scripts/cron-scheduler.ts`.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  const secretHeader = request.headers.get("x-cron-secret");
  return authHeader === `Bearer ${secret}` || secretHeader === secret;
}
