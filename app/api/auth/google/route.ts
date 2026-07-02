import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client, type GoogleAccountType } from "@/lib/google-client";

const SCOPES: Record<GoogleAccountType, string[]> = {
  gmail: [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  calendar: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
};

export async function GET(request: NextRequest) {
  const type = (request.nextUrl.searchParams.get("type") ?? "gmail") as GoogleAccountType;

  if (!["gmail", "calendar"].includes(type)) {
    return NextResponse.json({ error: "Type invalide. Utilise 'gmail' ou 'calendar'." }, { status: 400 });
  }

  const oauth2Client = createOAuth2Client();
  const state = Buffer.from(JSON.stringify({ type, redirect: "/" })).toString("base64url");

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES[type],
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(authUrl);
}
