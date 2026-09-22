import { NextRequest, NextResponse } from "next/server";
import { getSchedule, syncSchedule, logActivity } from "@/lib/storage";
import { safeErrorMessage } from "@/lib/utils";
import { serverLog } from "@/lib/logger";

// GET /api/schedule → emploi du temps en cache (data/schedule.json)
export async function GET() {
  try {
    const data = await getSchedule();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[schedule] GET error:", err);
    return NextResponse.json({ error: safeErrorMessage(err) }, { status: 500 });
  }
}

// POST /api/schedule → force une synchronisation CESAR
export async function POST(_request: NextRequest) {
  try {
    const data = await syncSchedule();
    if (!data.ok) {
      return NextResponse.json({ error: data.error || "Synchronisation CESAR en echec" }, { status: 502 });
    }
    await logActivity("schedule_synced", `Emploi du temps synchronise : ${data.courses.length} seances`, "source CESAR");
    return NextResponse.json(data);
  } catch (err) {
    void serverLog("schedule", "error", "POST /api/schedule failed", err);
    return NextResponse.json({ error: safeErrorMessage(err) }, { status: 500 });
  }
}
