import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwt, SESSION_COOKIE } from "./lib/session-edge";

const PUBLIC_PATHS = ["/login", "/_next", "/favicon.ico"];
const PUBLIC_API_PREFIXES = ["/api/auth/"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyJwt<{ sub: string }>(token) : null;
  const isAuthenticated = !!session;

  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    if (request.method !== "GET") {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
