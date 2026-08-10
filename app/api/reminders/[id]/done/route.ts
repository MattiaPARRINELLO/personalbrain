import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateReminder } from "@/lib/storage";
import { pushReminderUpdateToMicrosoft } from "@/lib/reminder-sync";
import { getSession } from "@/lib/session";

// Marque un rappel "fait". Appelé par le service worker (notification push)
// et l'UI. Doit reproduire le comportement de l'action markReminderStatus :
// propagation vers Microsoft To Do + revalidation de la liste, sinon le
// statut local et la tâche MS divergent.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  const r = await updateReminder(id, { status: "done", notifiedAt: new Date().toISOString() });
  if (!r) return NextResponse.json({ error: "Rappel introuvable" }, { status: 404 });
  await pushReminderUpdateToMicrosoft(r);
  revalidatePath("/reminders");
  return NextResponse.json({ ok: true });
}
