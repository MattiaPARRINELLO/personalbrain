import { promises as fs } from "fs";
import path from "path";
import { writeJsonAtomic } from "./storage";
import type { MicrosoftTodoList, MicrosoftTodoTask } from "./types";

export type { MicrosoftTodoList, MicrosoftTodoTask };

// Samsung Reminder se synchronise avec Microsoft To Do : on lit les reminders
// via le Microsoft Graph todo API (officiel et documenté), contrairement à
// l'API privée Samsung Cloud.

export type MicrosoftTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expiry_date?: number;
  scope?: string;
};

const AUTH_BASE = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
export const MICROSOFT_SCOPES = "offline_access Tasks.ReadWrite User.Read";

const MAX_REFRESH_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REFRESH_TIMEOUT_MS = 15_000;
const GRAPH_TIMEOUT_MS = 20_000;

// Mutex : une seule demande de refresh concurrente pour éviter le
// invalid_grant quand deux requêtes expirent ensemble.
let refreshInFlight: Promise<MicrosoftTokens> | null = null;

function tokenPath(): string {
  return path.join(process.cwd(), "data", "microsoft-todo-token.json");
}

function requiredEnv() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET et MICROSOFT_REDIRECT_URI doivent etre configures");
  }

  return { clientId, clientSecret, redirectUri };
}

export function createMicrosoftAuthUrl(state: string): string {
  const { clientId, redirectUri } = requiredEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: MICROSOFT_SCOPES,
    state,
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

export async function loadMicrosoftTokens(): Promise<MicrosoftTokens | null> {
  try {
    const raw = await fs.readFile(tokenPath(), "utf-8");
    return JSON.parse(raw) as MicrosoftTokens;
  } catch {
    return null;
  }
}

export async function saveMicrosoftTokens(tokens: MicrosoftTokens): Promise<void> {
  // On mémorise l'expiration estimée pour déclencher le refresh avant l'échéance.
  const withExpiry: MicrosoftTokens = {
    ...tokens,
    expiry_date: Date.now() + (tokens.expires_in ?? 3600) * 1000,
  };
  await writeJsonAtomic("microsoft-todo-token.json", withExpiry);
}

export async function getMicrosoftTokensFromCode(code: string): Promise<MicrosoftTokens> {
  const { clientId, clientSecret, redirectUri } = requiredEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: MICROSOFT_SCOPES,
  });

  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token error ${res.status}: ${text.slice(0, 300)}`);
  }

  const tokens = (await res.json()) as MicrosoftTokens;
  if (!tokens.refresh_token) {
    throw new Error("Aucun refresh token recu. Revoque l'acces depuis ton compte Microsoft et reessaie.");
  }
  return tokens;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function doRefreshTokens(): Promise<MicrosoftTokens> {
  const { clientId, clientSecret } = requiredEnv();
  const tokens = await loadMicrosoftTokens();
  if (!tokens?.refresh_token) {
    throw new Error("Aucun refresh token Microsoft disponible. Reconnecte ton compte.");
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_REFRESH_RETRIES; attempt++) {
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token",
        scope: MICROSOFT_SCOPES,
      });

      const res = await fetch(`${AUTH_BASE}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Microsoft refresh error ${res.status}: ${text.slice(0, 300)}`);
      }

      const refreshed = (await res.json()) as MicrosoftTokens;
      if (!refreshed.access_token) {
        throw new Error("Reponse de refresh Microsoft invalide");
      }
      await saveMicrosoftTokens(refreshed);
      return refreshed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[microsoft-client] Refresh attempt ${attempt + 1}/${MAX_REFRESH_RETRIES} failed:`, lastError.message);
      if (attempt < MAX_REFRESH_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  console.error("[microsoft-client] All refresh attempts failed. User must re-authenticate.");
  throw new Error(
    `La session Microsoft To Do a expire et le rafraichissement a echoue apres ${MAX_REFRESH_RETRIES} tentatives. ` +
    "Va sur /api/auth/microsoft pour reconnecter."
  );
}

async function refreshTokensWithLock(): Promise<MicrosoftTokens> {
  if (refreshInFlight) return refreshInFlight;
  const promise = doRefreshTokens().finally(() => {
    refreshInFlight = null;
  });
  refreshInFlight = promise;
  return promise;
}

export async function getMicrosoftAccessToken(): Promise<string> {
  const tokens = await loadMicrosoftTokens();
  if (!tokens?.refresh_token) {
    throw new Error("Compte Microsoft To Do non lie. Va sur /api/auth/microsoft pour t'authentifier.");
  }

  if (tokens.expiry_date && Date.now() >= tokens.expiry_date - 60_000) {
    const refreshed = await refreshTokensWithLock();
    return refreshed.access_token;
  }
  if (!tokens.access_token) {
    throw new Error("Access token Microsoft manquant. Reconnecte ton compte.");
  }
  return tokens.access_token;
}

export async function microsoftGraphFetch<T>(graphPath: string, init?: RequestInit): Promise<T> {
  const accessToken = await getMicrosoftAccessToken();

  const res = await fetch(`${GRAPH_BASE}${graphPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft Graph error ${res.status}: ${text.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

export async function isMicrosoftLinked(): Promise<boolean> {
  const tokens = await loadMicrosoftTokens();
  return !!tokens?.refresh_token;
}
