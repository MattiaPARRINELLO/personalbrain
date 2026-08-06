import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { Card, CardBody } from "@/components/ui/Card";
import { loadFocus } from "@/app/actions/focus";
import { FocusTimer } from "./FocusTimer";

export default async function FocusPage() {
  const state = await loadFocus();
  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Une tâche à la fois"
            title="Focus"
            description="Un minuteur, le téléphone qui se tait, et la preuve que la séance a eu lieu."
          />
          <Card>
            <CardBody>
              <FocusTimer initialState={state} />
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
