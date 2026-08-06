import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { signJwt, SESSION_TTL_SECONDS } from "@/lib/session-core";
import { assertSameOrigin } from "@/lib/csrf";

// POST + vérification d'origine : un site tiers ne peut pas faire échanger
// le JWT de l'utilisateur connecté (le cookie SameSite=Lax n'est de toute
// façon pas envoyé sur les POST cross-origin, double garde).
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origine invalide" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ token: null });
  }

  const token = await signJwt({
    sub: session.userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });

  return NextResponse.json({ token });
}
