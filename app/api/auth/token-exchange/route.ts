import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { signJwt, SESSION_TTL_SECONDS } from "@/lib/session-core";

export async function GET() {
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
