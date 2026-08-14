"use server";

import { requireSession } from "@/lib/session";
import { getConfig, updateConfig } from "@/lib/config";
import { getSubscriptions } from "@/lib/push-subscriptions";
import { fetchAvailableModels } from "@/lib/ai-providers/models";
import { z } from "zod";

// État d'exécution pour le tableau de santé des intégrations (Paramètres) :
// modèles IA configurés, fonctionnalités et nombre d'appareils push.
export async function loadRuntimeInfo(): Promise<{
  models: { general: string; generalAlt: string; code: string };
  availableModels: string[];
  features: { dailyBrief: boolean; webSearch: boolean };
  pushCount: number;
}> {
  await requireSession();
  const [config, subs, availableModels] = await Promise.all([
    getConfig(),
    getSubscriptions(),
    fetchAvailableModels(),
  ]);
  return {
    models: {
      general: config.models.general,
      generalAlt: config.models.generalAlt,
      code: config.models.code,
    },
    availableModels,
    features: config.features,
    pushCount: subs.length,
  };
}

const modelField = z
  .string()
  .trim()
  .min(1, "Modele requis")
  .max(100, "Nom de modele trop long");

const updateModelsSchema = z
  .object({
    general: modelField,
    generalAlt: modelField,
    code: modelField,
  })
  .strict();

// Met à jour les modèles IA (principal, secours, code) choisis par l'utilisateur.
export async function updateModels(input: {
  general: string;
  generalAlt: string;
  code: string;
}): Promise<{ general: string; generalAlt: string; code: string }> {
  await requireSession();

  const parsed = updateModelsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }

  const { general, generalAlt, code } = parsed.data;
  const available = await fetchAvailableModels();
  for (const m of [general, generalAlt, code]) {
    if (!available.includes(m)) {
      throw new Error(`Modele indisponible : ${m}`);
    }
  }

  await updateConfig({ models: { general, generalAlt, code } });
  return { general, generalAlt, code };
}
