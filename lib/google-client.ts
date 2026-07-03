import { OAuth2Client, type Credentials } from "google-auth-library";
import { promises as fs } from "fs";
import path from "path";

export type GoogleAccountType = "gmail" | "calendar";
export type GoogleTokens = Credentials;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

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

  return new OAuth2Client(clientId, clientSecret, redirectUri);
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
  const tmpPath = tokenPath(type) + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(tokens, null, 2), "utf-8");
  await fs.rename(tmpPath, tokenPath(type));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getGoogleClient(type: GoogleAccountType) {
  const oauth2Client = createOAuth2Client();
  const tokens = await loadTokens(type);

  if (!tokens) {
    throw new Error(`Compte ${type} non lie. Va sur /api/auth/google?type=${type} pour t'authentifier.`);
  }

  oauth2Client.setCredentials(tokens);

  // Rafraichissement automatique avec retry exponentiel
  const expiry = tokens.expiry_date;
  if (tokens.refresh_token && expiry && Date.now() >= expiry - 60000) {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await saveTokens(type, credentials);
        oauth2Client.setCredentials(credentials);
        lastError = null;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[google-client] Refresh token attempt ${attempt + 1}/${MAX_RETRIES} failed for ${type}:`, lastError.message);
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
        }
      }
    }
    if (lastError) {
      console.error(`[google-client] All ${MAX_RETRIES} refresh attempts failed for ${type}. User must re-authenticate.`);
      throw new Error(
        `La session ${type} a expire et le rafraichissement a echoue apres ${MAX_RETRIES} tentatives. ` +
        `Va sur /api/auth/google?type=${type} pour reconnecter.`
      );
    }
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
