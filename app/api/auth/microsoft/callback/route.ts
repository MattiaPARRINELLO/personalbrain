import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftTokensFromCode, saveMicrosoftTokens } from "@/lib/microsoft-client";
import { requireSession } from "@/lib/session";
import { serverLog } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const detail = errorDescription ? ` (${errorDescription})` : "";
    void serverLog("microsoft-callback", "error", `OAuth error: ${error}${detail}`);
    return NextResponse.json({ error: `Microsoft OAuth error: ${error}${detail}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    const tokens = await getMicrosoftTokensFromCode(code);
    await saveMicrosoftTokens(tokens);
    return NextResponse.redirect(new URL("/reminders?todo=linked", request.url));
  } catch (err) {
    void serverLog("microsoft-callback", "error", "Microsoft callback error", err, true);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
