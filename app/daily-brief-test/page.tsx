import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { Card, CardBody } from "@/components/ui/Card";
import { DailyBriefTester } from "./DailyBriefTester";

export default function DailyBriefTestPage() {
  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Test / notifications"
            title="Daily brief"
            description="Lance une génération et un envoi push du brief du jour, à n'importe quelle heure."
          />
          <Card>
            <CardBody>
              <DailyBriefTester />
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
