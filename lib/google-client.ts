import { google } from "googleapis";
import type { Credentials } from "google-auth-library";
import { promises as fs } from "fs";
import path from "path";

export type GoogleAccountType = "gmail" | "calendar";
export type GoogleTokens = Credentials;

function tokenPath(type: GoogleAccountType): string {
  return path.join(process.cwd(), "data", `${type}-token.json`);
}

export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI doivent etre configures");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function loadTokens(type: GoogleAccountType): Promise<GoogleTokens | null> {
  try {
    const raw = await fs.readFile(tokenPath(type), "utf-8");
    return JSON.parse(raw) as GoogleTokens;
  } catch {
    return null;
  }
}

export async function saveTokens(type: GoogleAccountType, tokens: GoogleTokens): Promise<void> {
  await fs.mkdir(path.dirname(tokenPath(type)), { recursive: true });
  await fs.writeFile(tokenPath(type), JSON.stringify(tokens, null, 2), "utf-8");
}

export async function getGoogleClient(type: GoogleAccountType) {
  const oauth2Client = createOAuth2Client();
  const tokens = await loadTokens(type);

  if (!tokens) {
    throw new Error(`Compte ${type} non lie. Va sur /api/auth/google?type=${type} pour t'authentifier.`);
  }

  oauth2Client.setCredentials(tokens);

  // Rafraichissement automatique si le token expire dans moins de 60 secondes
  const expiry = tokens.expiry_date;
  if (tokens.refresh_token && expiry && Date.now() >= expiry - 60000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await saveTokens(type, credentials);
    oauth2Client.setCredentials(credentials);
  }

  return oauth2Client;
}

export async function getGmailClient() {
  return getGoogleClient("gmail");
}

export async function getCalendarClient() {
  return getGoogleClient("calendar");
}

export async function isGoogleLinked(type: GoogleAccountType): Promise<boolean> {
  const tokens = await loadTokens(type);
  return !!tokens?.refresh_token;
}
