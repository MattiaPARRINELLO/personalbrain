import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { triggerDailyBrief } = await import("@/lib/notification-scheduler");
    await triggerDailyBrief();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[cron/daily-brief]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
