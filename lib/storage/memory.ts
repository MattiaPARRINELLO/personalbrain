import type { MemoryData, MemoryFact, MemoryRelationship } from "../types";
import { maybeBackup, mutateJson, readOrCreate, writeJsonAtomic } from "../storage-core";

const defaultMemory: MemoryData = {
  relationships: [],
  profile: {
    name: "Mattia",
    preferences: ["TypeScript", "React", "Next.js", "photographie de concert"],
  },
  facts: [
    { id: "1", content: "Prefere coder en TypeScript", category: "dev", createdAt: new Date().toISOString() },
    { id: "2", content: "Prochain concert : Muse le 15 juillet 2026 a l'Accor Arena", category: "photo", createdAt: new Date().toISOString() },
  ],
};

export async function getMemory(): Promise<MemoryData> {
  return readOrCreate("memory.json", defaultMemory);
}

export async function saveMemory(data: MemoryData): Promise<void> {
  await maybeBackup("memory.json");
  return writeJsonAtomic("memory.json", data);
}

export async function addMemoryFact(
  content: string,
  category: MemoryFact["category"],
  options?: { source?: MemoryFact["source"]; confidence?: number }
): Promise<MemoryFact> {
  const fact: MemoryFact = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    content,
    category,
    createdAt: new Date().toISOString(),
    source: options?.source ?? "manual",
    confidence: options?.confidence,
    accessCount: 0,
  };
  await mutateJson<MemoryData>("memory.json", defaultMemory, (data) => {
    data.facts.push(fact);
  });
  return fact;
}

export async function updateMemoryFact(id: string, updates: Partial<Pick<MemoryFact, "content" | "category">>): Promise<MemoryFact | null> {
  let updated: MemoryFact | null = null;
  await mutateJson<MemoryData>("memory.json", defaultMemory, (data) => {
    const idx = data.facts.findIndex((f) => f.id === id);
    if (idx < 0) return null;
    data.facts[idx] = { ...data.facts[idx], ...updates };
    updated = data.facts[idx];
  });
  return updated;
}

export async function touchMemoryFact(id: string): Promise<void> {
  await mutateJson<MemoryData>("memory.json", defaultMemory, (data) => {
    const idx = data.facts.findIndex((f) => f.id === id);
    if (idx < 0) return null;
    data.facts[idx] = {
      ...data.facts[idx],
      accessCount: (data.facts[idx].accessCount ?? 0) + 1,
      lastAccessedAt: new Date().toISOString(),
    };
  });
}

export async function findSimilarMemoryFacts(content: string, category: MemoryFact["category"]): Promise<MemoryFact | null> {
  const data = await getMemory();
  const categoryFacts = data.facts.filter((f) => f.category === category);
  if (categoryFacts.length === 0) return null;

  // Try AI semantic matching
  try {
    const { chatCompletion } = await import("../ai-providers");
    const { getConfig } = await import("../config");
    const config = await getConfig();
    const model = config.models.generalAlt;

    const factsList = categoryFacts
      .map((f) => `- id=${f.id}: ${f.content}`)
      .join("\n");
    const result = await chatCompletion(
      model,
      [
        {
          role: "system",
          content:
            "Tu compares un nouveau texte avec une liste de faits existants. Retourne UNIQUEMENT l'id du fait le plus similaire sémantiquement, ou 'null' si aucun ne correspond. Ne retourne rien d'autre.",
        },
        {
          role: "user",
          content: `Nouveau texte: "${content}"\nFaits existants:\n${factsList}`,
        },
      ],
      []
    );

    const id = result.content.trim();
    if (id && id !== "null") {
      const found = categoryFacts.find((f) => f.id === id);
      if (found) return found;
    }
  } catch {
    // Fall back to exact match below
  }

  // Fallback: exact match (normalisé)
  const norm = (s: string) => s.toLowerCase().trim();
  const target = norm(content);
  return categoryFacts.find((f) => norm(f.content) === target) ?? null;
}

export async function deleteMemoryFact(id: string): Promise<boolean> {
  let deleted = false;
  await mutateJson<MemoryData>("memory.json", defaultMemory, (data) => {
    const before = data.facts.length;
    data.facts = data.facts.filter((f) => f.id !== id);
    deleted = data.facts.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
}

export async function getMemoryRelationships(): Promise<MemoryRelationship[]> {
  const data = await getMemory();
  return data.relationships ?? [];
}

export async function addMemoryRelationship(
  sourceId: string,
  targetId: string,
  type: string
): Promise<MemoryRelationship> {
  const rel: MemoryRelationship = {
    sourceId,
    targetId,
    type,
    createdAt: new Date().toISOString(),
  };
  await mutateJson<MemoryData>("memory.json", defaultMemory, (data) => {
    const exists = data.relationships.some(
      (r) => r.sourceId === sourceId && r.targetId === targetId && r.type === type
    );
    if (exists) return null;
    data.relationships.push(rel);
  });
  return rel;
}

export async function getRelatedFacts(factId: string): Promise<{ fact: MemoryFact; relationship: MemoryRelationship }[]> {
  const data = await getMemory();
  const rels = data.relationships.filter(
    (r) => r.sourceId === factId || r.targetId === factId
  );
  const result: { fact: MemoryFact; relationship: MemoryRelationship }[] = [];
  for (const rel of rels) {
    const otherId = rel.sourceId === factId ? rel.targetId : rel.sourceId;
    const fact = data.facts.find((f) => f.id === otherId);
    if (fact) result.push({ fact, relationship: rel });
  }
  return result;
}
