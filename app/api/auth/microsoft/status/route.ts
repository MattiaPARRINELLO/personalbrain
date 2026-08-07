import { NextResponse } from "next/server";
import { isMicrosoftLinked } from "@/lib/microsoft-client";
import { getServerCached, setServerCached } from "@/lib/server-cache";
import { requireSession } from "@/lib/session";

const MICROSOFT_STATUS_CACHE_KEY = "microsoft:status";
const MICROSOFT_STATUS_TTL_MS = 60 * 1000;

export async function GET() {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const cached = getServerCached<{ linked: boolean }>(MICROSOFT_STATUS_CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    const response = { linked: await isMicrosoftLinked() };
    setServerCached(MICROSOFT_STATUS_CACHE_KEY, response, MICROSOFT_STATUS_TTL_MS);
    return NextResponse.json(response);
  } catch (err) {
    console.error("Microsoft status error:", err);
    return NextResponse.json({ linked: false }, { status: 500 });
  }
}
