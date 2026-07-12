import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session-core";

export async function POST(request: NextRequest) {
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
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}
