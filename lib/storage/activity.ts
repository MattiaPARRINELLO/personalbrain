import type { ActivityAction, ActivityData, ActivityEntry } from "../types";
import { mutateJson, newId, readOrCreate } from "../storage-core";

const MAX_ACTIVITY_ENTRIES = 200;
const defaultActivity: ActivityData = { entries: [] };

export async function getActivity(limit = 50): Promise<ActivityEntry[]> {
  const data = await readOrCreate("activity.json", defaultActivity);
  return data.entries.slice(0, limit);
}

export async function logActivity(action: ActivityAction, label: string, details?: string): Promise<void> {
  const entry: ActivityEntry = {
    id: newId(),
    action,
    label,
    details,
    createdAt: new Date().toISOString(),
  };
  await mutateJson<ActivityData>("activity.json", defaultActivity, (data) => {
    data.entries.unshift(entry);
    if (data.entries.length > MAX_ACTIVITY_ENTRIES) {
      data.entries = data.entries.slice(0, MAX_ACTIVITY_ENTRIES);
    }
  });
}
