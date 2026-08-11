import { headers } from "next/headers";
import { randomUUID } from "crypto";

const REQUEST_ID_HEADER = "x-request-id";

// Identifiant de corrélation : posé par le middleware (edge) dans les headers
// de requête, relu ici côté node. Hors contexte de requête (scheduler, cron
// interne), retourne "bg" (background) pour distinguer les logs de fond.
export async function getRequestId(): Promise<string> {
  try {
    const h = await headers();
    return h.get(REQUEST_ID_HEADER) ?? "bg";
  } catch {
    return "bg";
  }
}

export function generateRequestId(): string {
  return randomUUID().slice(0, 8);
}

// Logger serveur préfixé par module + identifiant de corrélation.
// `external = true` marque les erreurs de services externes (Google, MS,
// Brave, OpenWeather, providers IA) pour les distinguer des erreurs internes.
export async function serverLog(
  module: string,
  level: "error" | "warn",
  message: string,
  err?: unknown,
  external = false
): Promise<void> {
  const id = await getRequestId();
  const tag = external ? " [ext]" : "";
  const detail = err instanceof Error ? ` — ${err.message}` : err != null ? ` — ${String(err)}` : "";
  const line = `[${module}] [req:${id}]${tag} ${message}${detail}`;
  if (level === "warn") {
    console.warn(line);
  } else {
    console.error(line);
  }
}
