export type MemoryCategory = "dev" | "photo" | "life" | "preference";

export type MemorySource = "manual" | "tool" | "auto-extract";

export interface MemoryRelationship {
  sourceId: string;
  targetId: string;
  type: string; // e.g. "shoote_au", "est_musicien", "collabore_avec"
  createdAt: string;
}

export interface MemoryFact {
  id: string;
  content: string;
  category: MemoryCategory;
  createdAt: string;
  source?: MemorySource;
  confidence?: number;
  accessCount?: number;
  lastAccessedAt?: string;
}

export interface MemoryData {
  relationships: MemoryRelationship[];
  profile: {
    name: string;
    preferences: string[];
  };
  facts: MemoryFact[];
}
