const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_KEY = process.env.IA_API_KEY;

export function getClientConfig() {
  if (!API_URL || !API_KEY) {
    throw new Error("NEXT_PUBLIC_API_URL et IA_API_KEY doivent etre configures");
  }
  return { baseURL: API_URL, apiKey: API_KEY };
}

// Source unique des modèles proposés à l'utilisateur (Paramètres → Modèles d'IA).
const OPENAI_MODELS: readonly string[] = [
  "deepseek-v4-pro",
  "deepseek-v4-flash",
  "kimi-k2.6",
  "kimi-k2.7-code",
];

const ANTHROPIC_MODELS: readonly string[] = [
  "qwen3.7-max",
  "qwen3.7-plus",
  "qwen3.6-plus",
  "minimax-m3",
  "minimax-m2.7",
  "minimax-m2.5",
];

export const AVAILABLE_MODELS: readonly string[] = [...OPENAI_MODELS, ...ANTHROPIC_MODELS];

export function isAnthropicModel(model: string): boolean {
  return ANTHROPIC_MODELS.includes(model);
}

// Timeout de sécurité sur les appels IA (les SDK par défaut peuvent pendre
// jusqu'à 10 minutes sans réponse du provider).
export const REQUEST_TIMEOUT_MS = 120_000;
