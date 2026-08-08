import { Code2, Camera, Heart, User } from "lucide-react";
import type { MemoryCategory, MemoryFact } from "@/lib/types";

export const categoryMeta: Record<MemoryCategory, { label: string; icon: typeof Code2; tone: "accent" | "warm" | "success" | "muted" }> = {
  dev: { label: "Code", icon: Code2, tone: "accent" },
  photo: { label: "Photo", icon: Camera, tone: "warm" },
  life: { label: "Vie", icon: Heart, tone: "success" },
  preference: { label: "Préférence", icon: User, tone: "muted" },
};

export type Filter = "all" | MemoryCategory;

export const ALL_FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "dev", label: "Code" },
  { id: "photo", label: "Photo" },
  { id: "life", label: "Vie" },
  { id: "preference", label: "Préférences" },
];

export function groupByCategory(facts: MemoryFact[]): Record<MemoryCategory, MemoryFact[]> {
  const out: Record<MemoryCategory, MemoryFact[]> = {
    dev: [],
    photo: [],
    life: [],
    preference: [],
  };
  for (const f of facts) out[f.category].push(f);
  for (const k of Object.keys(out) as MemoryCategory[]) {
    out[k].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
  return out;
}
