import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client, saveTokens, clearGoogleBroken, type GoogleAccountType } from "@/lib/google-client";
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
  const stateRaw = searchParams.get("state");

  let type: GoogleAccountType = "gmail";
  // Destination retour : par défaut l'application. Le state n'est pas signé,
  // on ne suit donc que des chemins relatifs simples (anti open-redirect).
  let redirect = "/chat";
  try {
    if (stateRaw) {
      const parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf-8")) as { type?: GoogleAccountType; redirect?: string };
      if (parsed.type === "calendar") type = "calendar";
      if (typeof parsed.redirect === "string" && /^\/[^/]/.test(parsed.redirect)) {
        redirect = parsed.redirect;
      }
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
    // Re-link réussi : lève la bannière « à reconnecter » sans attendre
    // le premier refresh suivant (le marqueur de casse serait sinon obsolète).
    await clearGoogleBroken(type);
    const destination = new URL(redirect, request.url);
    destination.searchParams.set(type, "linked");
    return NextResponse.redirect(destination);
  } catch (err) {
    void serverLog("google-callback", "error", "Google callback error", err, true);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
