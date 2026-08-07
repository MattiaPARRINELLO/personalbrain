import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session-core";

export async function POST(request: NextRequest) {
  // Garde anti-CSRF : si la requête porte un header Origin (fetch cross-site,
  // formulaire), il doit correspondre au host de la requête. Les requêtes
  // sans Origin (appels serveur) restent autorisées.
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      return NextResponse.json({ error: "Origine invalide" }, { status: 403 });
    }
    const requestHost = request.headers.get("host") ?? "";
    const isLocalDev =
      process.env.NODE_ENV !== "production" &&
      (originHost === "localhost:3000" || originHost === "127.0.0.1:3000");
    if (originHost !== requestHost && !isLocalDev) {
      return NextResponse.json({ error: "Origine non autorisée" }, { status: 403 });
    }
  }

  const body = (await request.json()) as { token?: string };
  if (!body.token) {
    return NextResponse.json({ error: "Token requis" }, { status: 400 });
  }

  const payload = await verifyJwt<{ sub: string }>(body.token);
  if (!payload || !payload.sub) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, body.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}
