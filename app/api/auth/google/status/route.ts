import { NextResponse } from "next/server";
import { isGoogleLinked } from "@/lib/google-client";
import { getServerCached, setServerCached } from "@/lib/server-cache";

const GOOGLE_STATUS_CACHE_KEY = "google:status";
const GOOGLE_STATUS_TTL_MS = 60 * 1000;

export async function GET() {
  try {
    const cached = getServerCached<{ gmail: boolean; calendar: boolean }>(
      GOOGLE_STATUS_CACHE_KEY,
    );
    if (cached) {
      return NextResponse.json(cached);
    }

    const [gmail, calendar] = await Promise.all([
      isGoogleLinked("gmail"),
      isGoogleLinked("calendar"),
    ]);

    const response = { gmail, calendar };
    setServerCached(GOOGLE_STATUS_CACHE_KEY, response, GOOGLE_STATUS_TTL_MS);
    return NextResponse.json(response);
  } catch (err) {
    console.error("Google status error:", err);
    return NextResponse.json(
      { gmail: false, calendar: false },
      { status: 500 },
    );
  }
}
