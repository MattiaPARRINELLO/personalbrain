import path from "path";
import { writeJsonAtomic, readJsonSafe } from "./storage";

export interface AppConfig {
  models: {
    general: string;
    generalAlt: string;
    code: string;
    titleModel: string;
  };
  llm: {
    temperature: number;
    maxTokens: number;
  };
  features: {
    dailyBrief: boolean;
    webSearch: boolean;
  };
  theme: {
    accentColor: string;
  };
}

const CONFIG_FILENAME = "config.json";
const CONFIG_PATH = path.join(process.cwd(), "data", CONFIG_FILENAME);

const defaultConfig: AppConfig = {
  models: {
    general: "deepseek-v4-flash",
    generalAlt: "kimi-k2.6",
    code: "kimi-k2.7-code",
    titleModel: "deepseek-v4-flash",
  },
  llm: {
    temperature: 0.7,
    maxTokens: 4096,
  },
  features: {
    dailyBrief: false,
    webSearch: true,
  },
  theme: {
    accentColor: "#a5b4fc",
  },
};

const CACHE_TTL = 60_000;

let cachedConfig: { data: AppConfig; ts: number } | null = null;

function invalidateCache() {
  cachedConfig = null;
}

export async function getConfig(): Promise<AppConfig> {
  if (cachedConfig && Date.now() - cachedConfig.ts < CACHE_TTL) {
    return cachedConfig.data;
  }

  const parsed = await readJsonSafe<Partial<AppConfig>>(CONFIG_FILENAME, defaultConfig);
  const merged: AppConfig = { ...defaultConfig, ...parsed };
  cachedConfig = { data: merged, ts: Date.now() };
  return merged;
}

export async function updateConfig(partial: Partial<AppConfig>): Promise<AppConfig> {
  const current = await getConfig();
  const next: AppConfig = { ...current, ...partial };
  await writeJsonAtomic(CONFIG_FILENAME, next);
  cachedConfig = { data: next, ts: Date.now() };
  return next;
}

export function getConfigCachePath(): string {
  return CONFIG_PATH;
}

export function clearConfigCache() {
  invalidateCache();
}

export async function getModel(context: "general" | "code"): Promise<{ primary: string; alt: string }> {
  const config = await getConfig();
  if (context === "code") {
    return { primary: config.models.code, alt: config.models.code };
  }
  return { primary: config.models.general, alt: config.models.generalAlt };
}
