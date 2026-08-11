import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { serverLog } from "@/lib/logger";

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const { checkReminders, checkIntentions } = await import("@/lib/notification-scheduler");
    await checkReminders();
    await checkIntentions();
    return NextResponse.json({ success: true });
  } catch (err) {
    void serverLog("cron/reminders", "error", "Echec du run", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
