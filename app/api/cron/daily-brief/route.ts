import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { serverLog } from "@/lib/logger";

function clientIp(request: Request): string | undefined {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip");
  return real?.trim() || undefined;
}

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const { triggerDailyBrief } = await import("@/lib/notification-scheduler");
    await triggerDailyBrief("cron", clientIp(request));
    return NextResponse.json({ success: true });
  } catch (err) {
    void serverLog("cron/daily-brief", "error", "Echec du brief", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
