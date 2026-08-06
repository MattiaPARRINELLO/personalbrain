import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

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
    console.error("[cron/reminders]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
