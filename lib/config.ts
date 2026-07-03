import { promises as fs } from "fs";
import path from "path";

export interface AppConfig {
  models: {
    general: string;
    generalAlt: string;
    code: string;
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

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

const defaultConfig: AppConfig = {
  models: {
    general: "deepseek-v4-pro",
    generalAlt: "kimi-k2.6",
    code: "kimi-k2.7-code",
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

let cachedConfig: AppConfig | null = null;

export async function getConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    cachedConfig = { ...defaultConfig, ...JSON.parse(raw) };
    return cachedConfig!;
  } catch {
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), "utf-8");
    cachedConfig = defaultConfig;
    return defaultConfig;
  }
}

export async function updateConfig(partial: Partial<AppConfig>): Promise<AppConfig> {
  const current = await getConfig();
  const next = { ...current, ...partial };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
  cachedConfig = next;
  return next;
}

export async function getModel(context: "general" | "code"): Promise<{ primary: string; alt: string }> {
  const config = await getConfig();
  if (context === "code") {
    return { primary: config.models.code, alt: config.models.code };
  }
  return { primary: config.models.general, alt: config.models.generalAlt };
}
