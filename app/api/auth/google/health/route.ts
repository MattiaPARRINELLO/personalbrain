import { NextResponse } from "next/server";
import { checkGoogleHealth } from "@/lib/google-health";
import { getServerCached, setServerCached } from "@/lib/server-cache";

const CACHE_KEY = "google:health";
const CACHE_TTL_MS = 60 * 1000;

export async function GET() {
  try {
    const cached = getServerCached<Awaited<ReturnType<typeof checkGoogleHealth>>>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    const health = await checkGoogleHealth();
    setServerCached(CACHE_KEY, health, CACHE_TTL_MS);
    return NextResponse.json(health);
  } catch (err) {
    console.error("[api/auth/google/health] error:", err);
    return NextResponse.json(
      {
        gmail: { ok: false },
        calendar: { ok: false },
      },
      { status: 500 }
    );
  }
}
