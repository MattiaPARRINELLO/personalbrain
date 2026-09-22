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

// Aplatit un markdown simple en texte brut : les notifications push et les
// extraits courts ne doivent pas afficher "*", "#" ou les pipes d'un tableau.
export function markdownToText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, " ") // ligne séparatrice de tableau
    .replace(/^\s*\|(.+?)\|\s*$/gm, (_, row: string) =>
      row.split("|").map((cell) => cell.trim()).filter(Boolean).join(" · ") + " "
    )
    .replace(/^\s*[-*+]\s+/gm, "") // puces
    .replace(/^\s*\d+\.\s+/gm, "") // listes numérotées
    .replace(/^#{1,6}\s+/gm, "") // titres
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // liens
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
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
