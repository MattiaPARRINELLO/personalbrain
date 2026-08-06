import { NextResponse } from "next/server";
import { getReminders } from "@/lib/storage";
import { getSession } from "@/lib/session";

export async function GET() {
  // Route publique (pollée par le service worker) : sans session active, on
  // ne fuite aucune donnée personnelle — on renvoie une liste vide plutôt
  // qu'un 401 pour ne pas casser le polling du SW en arrière-plan.
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { reminders: [] },
      { headers: { "sw-cached-at": new Date().toISOString() } }
    );
  }

  const data = await getReminders();
  const pending = data.reminders.filter(
    (r) => r.status === "pending" && new Date(r.dueAt).getTime() <= Date.now() + 60000
  );
  return NextResponse.json(
    { reminders: pending },
    { headers: { "sw-cached-at": new Date().toISOString() } }
  );
}
