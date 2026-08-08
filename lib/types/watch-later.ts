export type WatchLaterCategory = "video" | "article" | "photo" | "music" | "other";

export interface WatchLaterItem {
  id: string;
  url: string;
  title: string;
  description?: string;
  thumbnail?: string;
  source: string;
  category: WatchLaterCategory;
  createdAt: string;
  summary?: string;
  aiTags?: string[];
  read?: boolean;
}

export interface WatchLaterData {
  items: WatchLaterItem[];
}
