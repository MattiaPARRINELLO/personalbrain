import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const { triggerDailyBrief } = await import("@/lib/notification-scheduler");
    await triggerDailyBrief();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[cron/daily-brief]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
