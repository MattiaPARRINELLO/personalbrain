import { readJsonSafe, writeJsonAtomic } from "./storage";

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

export async function getSubscriptions(): Promise<StoredPushSubscription[]> {
  const data = await readJsonSafe<PushSubscriptionsData>(FILENAME, { subscriptions: [] });
  return data.subscriptions;
}

export async function addSubscription(sub: StoredPushSubscription): Promise<void> {
  const data = await readJsonSafe<PushSubscriptionsData>(FILENAME, { subscriptions: [] });
  const exists = data.subscriptions.some(
    (s) => s.endpoint === sub.endpoint
  );
  if (!exists) {
    data.subscriptions.push(sub);
    await writeJsonAtomic(FILENAME, data);
  }
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const data = await readJsonSafe<PushSubscriptionsData>(FILENAME, { subscriptions: [] });
  data.subscriptions = data.subscriptions.filter((s) => s.endpoint !== endpoint);
  await writeJsonAtomic(FILENAME, data);
}
