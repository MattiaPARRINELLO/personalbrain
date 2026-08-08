import { Play, FileText, Image as ImageIcon, Music2, Globe, Filter } from "lucide-react";
import type { WatchLaterCategory } from "@/lib/types";

export const categoryMeta: Record<WatchLaterCategory, { label: string; icon: typeof Play; tone: "accent" | "warm" | "success" | "muted" | "danger" }> = {
  video: { label: "Vidéos", icon: Play, tone: "accent" },
  article: { label: "Écrits", icon: FileText, tone: "success" },
  photo: { label: "Photos", icon: ImageIcon, tone: "warm" },
  music: { label: "Musique", icon: Music2, tone: "muted" },
  other: { label: "Autres", icon: Globe, tone: "muted" },
};

export const FILTER_ORDER: { id: "all" | WatchLaterCategory; label: string; icon: typeof Play }[] = [
  { id: "all", label: "Tout", icon: Filter },
  { id: "video", label: "Vidéos", icon: Play },
  { id: "article", label: "Articles", icon: FileText },
  { id: "photo", label: "Photos", icon: ImageIcon },
  { id: "music", label: "Musique", icon: Music2 },
  { id: "other", label: "Autres", icon: Globe },
];

export type FilterId = "all" | WatchLaterCategory;
