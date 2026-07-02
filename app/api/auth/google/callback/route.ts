import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client, saveTokens, type GoogleAccountType } from "@/lib/google-client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const stateRaw = searchParams.get("state");

  let type: GoogleAccountType = "gmail";
  try {
    if (stateRaw) {
      const parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf-8")) as { type?: GoogleAccountType };
      if (parsed.type === "calendar") type = "calendar";
    }
  } catch {
    type = "gmail";
  }

  if (error) {
    return NextResponse.json({ error: `Google OAuth error: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        { error: "Aucun refresh token recu. Revoque l'acces depuis ton compte Google et reessaie." },
        { status: 400 }
      );
    }

    await saveTokens(type, tokens);
    return NextResponse.redirect(new URL(`/?${type}=linked`, request.url));
  } catch (err) {
    console.error("Google callback error:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
