import { readJsonSafe } from "./storage";
import { mutateJson } from "./storage-core";

export interface StoredPushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushSubscriptionsData {
  subscriptions: StoredPushSubscription[];
}

const FILENAME = "push-subscriptions.json";
const defaultData: PushSubscriptionsData = { subscriptions: [] };

export async function getSubscriptions(): Promise<StoredPushSubscription[]> {
  const data = await readJsonSafe<PushSubscriptionsData>(FILENAME, defaultData);
  return data.subscriptions;
}

export async function addSubscription(sub: StoredPushSubscription): Promise<void> {
  // mutateJson : le read→mutate→write se fait sous un seul lock par fichier
  // (aucune perte d'entrée si deux ajouts sont simultanés).
  await mutateJson<PushSubscriptionsData>(FILENAME, defaultData, (data) => {
    const exists = data.subscriptions.some((s) => s.endpoint === sub.endpoint);
    if (exists) return null; // aucun changement → pas d'écriture
    data.subscriptions.push(sub);
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await mutateJson<PushSubscriptionsData>(FILENAME, defaultData, (data) => {
    const before = data.subscriptions.length;
    data.subscriptions = data.subscriptions.filter((s) => s.endpoint !== endpoint);
    if (data.subscriptions.length === before) return null; // introuvable → pas d'écriture
  });
}
