import { getClientConfig, AVAILABLE_MODELS } from "./config";
import { getServerCached, setServerCached } from "@/lib/server-cache";

const CACHE_KEY = "available-models";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const FETCH_TIMEOUT_MS = 10_000;

// Liste des modèles proposés par l'endpoint IA (GET {baseURL}/models), avec
// cache mémoire+disque. En cas d'échec réseau ou de liste vide, repli sur la
// liste connue pour ne jamais bloquer l'interface.
export async function fetchAvailableModels(): Promise<string[]> {
  const cached = getServerCached<string[]>(CACHE_KEY);
  if (cached && cached.length > 0) return cached;

  try {
    const { baseURL, apiKey } = getClientConfig();
    const res = await fetch(`${baseURL.replace(/\/+$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status=${res.status}`);
    const body = (await res.json()) as { data?: { id?: string; model?: string }[] };
    const models = (body.data ?? [])
      .map((m) => m.id ?? m.model ?? "")
      .filter((m) => m.length > 0);
    if (models.length === 0) throw new Error("liste vide");
    setServerCached(CACHE_KEY, models, CACHE_TTL_MS);
    return models;
  } catch (err) {
    console.warn("[ai-models] Recuperation des modeles echouee, repli sur la liste connue:", err);
    return [...AVAILABLE_MODELS];
  }
}
