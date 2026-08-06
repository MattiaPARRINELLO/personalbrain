import { NextRequest } from "next/server";

// Origine attendue : dérivée de la requête elle-même (proto + Host), que
// l'attaquant ne contrôle pas. Compare avec Origin ou Referer si présents.
export function assertSameOrigin(request: NextRequest): boolean {
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const expected = `${proto}://${host}`;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === expected;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expected;
    } catch {
      return false;
    }
  }

  return false;
}
