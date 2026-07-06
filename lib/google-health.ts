import { getGoogleClient, loadTokens, type GoogleAccountType } from "./google-client";

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

export interface GoogleHealthEntry {
  ok: boolean;
  expiresIn?: number;
}

export interface GoogleHealthResult {
  gmail: GoogleHealthEntry;
  calendar: GoogleHealthEntry;
}

const ACCOUNT_TYPES: GoogleAccountType[] = ["gmail", "calendar"];

export async function checkGoogleHealth(): Promise<GoogleHealthResult> {
  const result: GoogleHealthResult = {
    gmail: { ok: false },
    calendar: { ok: false },
  };

  for (const type of ACCOUNT_TYPES) {
    try {
      const tokens = await loadTokens(type);
      if (!tokens?.refresh_token) continue;

      if (tokens.expiry_date && Date.now() >= tokens.expiry_date - REFRESH_THRESHOLD_MS) {
        await getGoogleClient(type);
      }

      const refreshed = await loadTokens(type);
      const expiry = refreshed?.expiry_date;
      result[type] = {
        ok: true,
        expiresIn: typeof expiry === "number" ? expiry - Date.now() : undefined,
      };
    } catch (err) {
      console.warn(`[google-health] Healthcheck failed for ${type}:`, err);
    }
  }

  return result;
}
