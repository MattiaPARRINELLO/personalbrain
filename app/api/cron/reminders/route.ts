import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { checkReminders } = await import("@/lib/notification-scheduler");
    await checkReminders();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[cron/reminders]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
