import type { Intention, IntentionsData } from "../types";
import { mutateJson, newId, readOrCreate } from "../storage-core";

const defaultIntentions: IntentionsData = { intentions: [] };

export async function getIntentions(): Promise<IntentionsData> {
  return readOrCreate("intentions.json", defaultIntentions);
}

export async function addIntention(input: {
  subject: string;
  message?: string;
  dueAt: string;
}): Promise<Intention> {
  const intention: Intention = {
    id: newId(),
    subject: input.subject.trim(),
    message: input.message?.trim() || undefined,
    dueAt: input.dueAt,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await mutateJson<IntentionsData>("intentions.json", defaultIntentions, (data) => {
    data.intentions.unshift(intention);
  });
  return intention;
}

export async function listPendingIntentions(): Promise<Intention[]> {
  const data = await getIntentions();
  return data.intentions.filter((i) => i.status === "pending");
}

export async function resolveIntention(
  id: string,
  status: "done" | "cancelled"
): Promise<boolean> {
  let resolved = false;
  await mutateJson<IntentionsData>("intentions.json", defaultIntentions, (data) => {
    const idx = data.intentions.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    data.intentions[idx] = {
      ...data.intentions[idx],
      status,
      resolvedAt: new Date().toISOString(),
    };
    resolved = true;
  });
  return resolved;
}
