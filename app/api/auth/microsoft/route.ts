import { NextResponse } from "next/server";
import { createMicrosoftAuthUrl } from "@/lib/microsoft-client";
import { requireSession } from "@/lib/session";

export async function GET() {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const state = Buffer.from(JSON.stringify({ redirect: "/reminders" })).toString("base64url");
  return NextResponse.redirect(createMicrosoftAuthUrl(state));
}
