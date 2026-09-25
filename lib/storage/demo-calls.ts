import type { DemoCallData, DemoCallEntry } from "../types";
import { mutateJson, newId, readOrCreate } from "../storage-core";

const MAX_DEMO_CALLS = 1000;
const defaultDemoCalls: DemoCallData = { calls: [] };

export async function getDemoCalls(limit = 1000): Promise<DemoCallEntry[]> {
  const data = await readOrCreate("demo-calls.json", defaultDemoCalls);
  return data.calls.slice(0, limit);
}

export async function recordDemoCall(entry: Omit<DemoCallEntry, "id" | "createdAt">): Promise<void> {
  const call: DemoCallEntry = {
    ...entry,
    id: newId(),
    createdAt: new Date().toISOString(),
  };
  await mutateJson<DemoCallData>("demo-calls.json", defaultDemoCalls, (data) => {
    data.calls.unshift(call);
    if (data.calls.length > MAX_DEMO_CALLS) {
      data.calls = data.calls.slice(0, MAX_DEMO_CALLS);
    }
  });
}
