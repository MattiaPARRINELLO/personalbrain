import { loadActivity } from "@/app/actions/activity";
import { ActivityView } from "./ActivityView";

export default async function ActivityPage() {
  const entries = await loadActivity(50);
  return <ActivityView entries={entries} />;
}
