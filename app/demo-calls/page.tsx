import { loadDemoCalls } from "@/app/actions/demo-calls";
import { DemoCallsView } from "./DemoCallsView";

export default async function DemoCallsPage() {
  const calls = await loadDemoCalls(1000);
  return <DemoCallsView initialCalls={calls} />;
}
