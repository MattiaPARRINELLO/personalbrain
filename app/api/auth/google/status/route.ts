import { NextResponse } from "next/server";
import { isGoogleLinked } from "@/lib/google-client";

export async function GET() {
  try {
    const [gmail, calendar] = await Promise.all([
      isGoogleLinked("gmail"),
      isGoogleLinked("calendar"),
    ]);

    return NextResponse.json({ gmail, calendar });
  } catch (err) {
    console.error("Google status error:", err);
    return NextResponse.json({ gmail: false, calendar: false }, { status: 500 });
  }
}
