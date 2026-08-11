import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwt, SESSION_COOKIE } from "./lib/session-edge";

// Identifiant de corrélation court, posé sur chaque requête edge et relu
// côté node par lib/logger (getRequestId) : permet de relier un log serveur
// à une requête précise dans les logs cPanel.
function withRequestId(request: NextRequest, response: NextResponse): NextResponse {
  const incoming = request.headers.get("x-request-id");
  if (incoming) {
    response.headers.set("x-request-id", incoming);
    return response;
  }
  const generated = Array.from({ length: 8 }, () =>
    "abcdef0123456789"[Math.floor(Math.random() * 16)]
  ).join("");
  response.headers.set("x-request-id", generated);
  return response;
}

const PUBLIC_PATHS = [
  "/login",
  "/notif",
  "/offline",
  "/privacy",
  "/",
];

const PUBLIC_FILE_EXTENSIONS = [
  ".js",
  ".json",
  ".ico",
  ".png",
  ".svg",
  ".webp",
  ".txt",
];

const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/cron",
  "/api/push",
  "/api/reminders/pending",
];

function extractRoute(pathname: string): string {
  // Client-side navigation data: _next/data/<buildId>/<route>.json or .rsc
  const match = pathname.match(/^\/_next\/data\/[^/]+\/(.+)\.(json|rsc)$/);
  if (match) {
    // Preserve nesting: /_next/data/abc123/chat.json -> /chat
    // /_next/data/abc123/settings.json -> /settings
    return "/" + match[1];
  }
  return pathname;
}

function isPublicPath(pathname: string): boolean {
  const route = extractRoute(pathname);

  // Public pages
  if (PUBLIC_PATHS.some((p) => route === p || route.startsWith(`${p}/`))) {
    return true;
  }

  // Public API prefixes
  if (PUBLIC_API_PREFIXES.some((p) => route.startsWith(p))) {
    return true;
  }

  // Public file extensions at root (sw.js, manifest.json, robots.txt, etc.)
  if (PUBLIC_FILE_EXTENSIONS.some((ext) => route.endsWith(ext))) {
    const lastSlash = route.lastIndexOf("/");
    const fileName = lastSlash >= 0 ? route.slice(lastSlash) : route;
    if (fileName.split("/").length <= 2 && !route.includes("/api/")) {
      return true;
    }
  }

  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return withRequestId(request, NextResponse.next());
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return withRequestId(
        request,
        NextResponse.json({ error: "Non authentifié" }, { status: 401 })
      );
    }
    return withRequestId(request, NextResponse.redirect(new URL("/login", request.url)));
  }

  const payload = await verifyJwt<{ sub: string }>(token);

  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return withRequestId(
        request,
        NextResponse.json({ error: "Session invalide" }, { status: 401 })
      );
    }
    return withRequestId(request, NextResponse.redirect(new URL("/login", request.url)));
  }

  return withRequestId(request, NextResponse.next());
}

export const config = {
  matcher: [
    // Run on all routes except static files served by Next.js
    "/((?!_next/static|_next/image|assets|icons|images|android-chrome-|apple-touch-).*)",
  ],
};
