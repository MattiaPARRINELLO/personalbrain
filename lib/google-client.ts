import { OAuth2Client, type Credentials } from "google-auth-library";
import { promises as fs } from "fs";
import path from "path";
import { writeJsonAtomic } from "./storage";
import { serverLog } from "./logger";

export type GoogleAccountType = "gmail" | "calendar";
export type GoogleTokens = Credentials;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REFRESH_TIMEOUT_MS = 15_000;

// Mutex par type de compte : deux requêtes simultanées avec un token expiré
// ne doivent PAS déclencher deux rafraîchissements concurrents (le second
// échoue en invalid_grant et peut écraser le token rafraîchi par le premier).
const refreshInFlight = new Map<GoogleAccountType, Promise<Credentials>>();

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
  // Réutilise l'écriture atomique du projet (tmp + rename, backups 30 min).
  await writeJsonAtomic(`${type}-token.json`, tokens);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function doRefreshTokens(type: GoogleAccountType): Promise<Credentials> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials((await loadTokens(type)) ?? {});

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Timeout de sécurité : le refresh Google ne doit pas pendre indéfiniment.
      const withTimeout = new Promise<{ credentials: Credentials }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Refresh token timeout")), REFRESH_TIMEOUT_MS);
        oauth2Client
          .refreshAccessToken()
          .then((result) => {
            clearTimeout(timer);
            resolve(result);
          })
          .catch((err: unknown) => {
            clearTimeout(timer);
            reject(err);
          });
      });
      const { credentials } = await withTimeout;
      await saveTokens(type, credentials);
      return credentials;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      void serverLog("google-client", "warn", `Refresh token attempt ${attempt + 1}/${MAX_RETRIES} failed for ${type}`, lastError, true);
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  void serverLog("google-client", "error", `All ${MAX_RETRIES} refresh attempts failed for ${type}. User must re-authenticate`, undefined, true);
  throw new Error(
    `La session ${type} a expire et le rafraichissement a echoue apres ${MAX_RETRIES} tentatives. ` +
    `Va sur /api/auth/google?type=${type} pour reconnecter.`
  );
}

async function refreshTokensWithLock(type: GoogleAccountType): Promise<Credentials> {
  const existing = refreshInFlight.get(type);
  if (existing) return existing;

  const promise = doRefreshTokens(type).finally(() => {
    refreshInFlight.delete(type);
  });
  refreshInFlight.set(type, promise);
  return promise;
}

export async function getGoogleClient(type: GoogleAccountType) {
  const oauth2Client = createOAuth2Client();
  const tokens = await loadTokens(type);

  if (!tokens) {
    throw new Error(`Compte ${type} non lie. Va sur /api/auth/google?type=${type} pour t'authentifier.`);
  }

  oauth2Client.setCredentials(tokens);

  // Rafraichissement automatique (un seul refresh concurrent par compte)
  const expiry = tokens.expiry_date;
  if (tokens.refresh_token && expiry && Date.now() >= expiry - 60000) {
    const credentials = await refreshTokensWithLock(type);
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
