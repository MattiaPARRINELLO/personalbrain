import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Retourne "YYYY-MM-DD" uniquement si la valeur est une date valide, sinon "".
export function toISODate(value: string | undefined | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

// Extrait "HH:MM" d'un timestamp ISO valide, sinon "".
export function toHHMM(value: string | undefined | null): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[4]}:${match[5]}` : "";
}

// Message d'erreur sûr à exposer côté client : les détails techniques bruts
// (corps de réponse Google API, chemins fs, tokens) sont masqués, tandis que
// les messages métier explicites (ex: "Compte gmail non lié...") sont gardés.
export function safeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : "Erreur inconnue";
  if (message.startsWith("Google API error")) {
    return "Erreur de l'API Google. Réessaie dans quelques instants.";
  }
  return message;
}
