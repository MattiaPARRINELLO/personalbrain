import { promises as fs } from "fs";
import path from "path";
import { writeJsonAtomic } from "./storage";
import { serverLog } from "./logger";
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
      void serverLog("microsoft-client", "warn", `Refresh attempt ${attempt + 1}/${MAX_REFRESH_RETRIES} failed`, lastError, true);
      if (attempt < MAX_REFRESH_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  void serverLog("microsoft-client", "error", "All refresh attempts failed. User must re-authenticate", undefined, true);
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

export async function microsoftGraphFetch<T>(
  graphPath: string,
  init?: RequestInit,
  opts?: { notFoundAsNull?: boolean }
): Promise<T> {
  const accessToken = await getMicrosoftAccessToken();

  const res = await fetch(`${GRAPH_BASE}${graphPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });

  if (res.status === 204) return null as T;
  if (opts?.notFoundAsNull && res.status === 404) return null as T;
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

type GraphListResponse<T> = { value: T[] };

// Liste par défaut "Tâches" : c'est le point d'entrée de la sync Samsung Reminder.
export async function getDefaultTodoListId(): Promise<string> {
  const data = await microsoftGraphFetch<GraphListResponse<MicrosoftTodoList>>(
    "/me/todo/lists?$top=100"
  );
  const tasks = data.value.find((l) => l.wellknownListName === "tasks") ?? data.value[0];
  if (!tasks) {
    throw new Error("Aucune liste Microsoft To Do disponible");
  }
  return tasks.id;
}

export type MicrosoftCreateTaskInput = {
  title: string;
  dueAt?: string;
  notes?: string;
};

export async function createMicrosoftTodoTask(
  listId: string,
  input: MicrosoftCreateTaskInput
): Promise<MicrosoftTodoTask> {
  const body: Record<string, unknown> = {
    title: input.title,
    status: "notStarted",
  };
  if (input.dueAt) {
    body.dueDateTime = { dateTime: new Date(input.dueAt).toISOString(), timeZone: "UTC" };
  }
  if (input.notes) {
    body.body = { contentType: "text", content: input.notes };
  }

  return microsoftGraphFetch<MicrosoftTodoTask>(
    `/me/todo/lists/${encodeURIComponent(listId)}/tasks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

export type MicrosoftUpdateTaskInput = {
  title?: string;
  // null supprime la date côté MS
  dueAt?: string | null;
  notes?: string | null;
  status?: "notStarted" | "completed";
};

export async function updateMicrosoftTodoTask(
  listId: string,
  taskId: string,
  input: MicrosoftUpdateTaskInput
): Promise<MicrosoftTodoTask> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.dueAt !== undefined) {
    body.dueDateTime = input.dueAt
      ? { dateTime: new Date(input.dueAt).toISOString(), timeZone: "UTC" }
      : null;
  }
  if (input.notes !== undefined) {
    body.body = input.notes ? { contentType: "text", content: input.notes } : null;
  }
  if (input.status !== undefined) body.status = input.status;

  return microsoftGraphFetch<MicrosoftTodoTask>(
    `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

export async function deleteMicrosoftTodoTask(listId: string, taskId: string): Promise<void> {
  await microsoftGraphFetch<null>(
    `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: "DELETE" }
  );
}

// Retourne null si la tâche n'existe plus (supprimée côté MS).
export async function getMicrosoftTodoTask(
  listId: string,
  taskId: string
): Promise<MicrosoftTodoTask | null> {
  return microsoftGraphFetch<MicrosoftTodoTask | null>(
    `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    undefined,
    { notFoundAsNull: true }
  );
}
