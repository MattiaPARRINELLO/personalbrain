import type { PhotoShootStatus } from "@/lib/types";

export const STATUS_FLOW: { key: PhotoShootStatus; label: string; color: string }[] = [
  { key: "upcoming", label: "À VENIR", color: "var(--text-3)" },
  { key: "done", label: "FAIT", color: "var(--accent)" },
  { key: "on_pc", label: "SUR PC", color: "var(--accent-cool)" },
  { key: "sorted", label: "TRIÉ", color: "var(--warm)" },
  { key: "edited", label: "RETOUCHÉ", color: "var(--accent)" },
  { key: "exported", label: "EXPORTÉ", color: "var(--accent-soft)" },
  { key: "sent", label: "ENVOYÉ", color: "var(--success)" },
];

export const STATUS_ORDER: PhotoShootStatus[] = [
  "upcoming", "done", "on_pc", "sorted", "edited", "exported", "sent",
];

export const STATUS_PILL_TONE: Record<PhotoShootStatus, "neutral" | "accent" | "warm" | "success" | "danger" | "muted"> = {
  upcoming: "neutral",
  done: "accent",
  on_pc: "accent",
  sorted: "warm",
  edited: "accent",
  exported: "warm",
  sent: "success",
};

export function statusIndex(s: PhotoShootStatus): number {
  return STATUS_ORDER.indexOf(s);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
