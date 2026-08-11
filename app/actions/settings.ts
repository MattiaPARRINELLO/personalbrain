"use server";

import { requireSession } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { getSubscriptions } from "@/lib/push-subscriptions";

// État d'exécution pour le tableau de santé des intégrations (Paramètres) :
// modèles IA configurés, fonctionnalités et nombre d'appareils push.
export async function loadRuntimeInfo(): Promise<{
  models: { general: string; code: string };
  features: { dailyBrief: boolean; webSearch: boolean };
  pushCount: number;
}> {
  await requireSession();
  const [config, subs] = await Promise.all([getConfig(), getSubscriptions()]);
  return {
    models: { general: config.models.general, code: config.models.code },
    features: config.features,
    pushCount: subs.length,
  };
}
