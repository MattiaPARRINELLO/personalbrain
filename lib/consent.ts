import { readJsonSafe, writeJsonAtomic } from "./storage";

export type ConsentState = {
  aiConsent: boolean;
  consentedAt?: string;
};

const CONSENT_FILE = "consent.json";
const defaultConsent: ConsentState = { aiConsent: false };

/**
 * Consentement explicite pour l'envoi des messages à l'IA.
 * Rien n'est envoyé au provider tant que l'utilisateur n'a pas accepté
 * l'écran de consentement (engagement de confidentialité, pas une sécurité).
 */
export async function getAiConsent(): Promise<ConsentState> {
  const data = await readJsonSafe<ConsentState>(CONSENT_FILE, defaultConsent);
  return {
    aiConsent: data?.aiConsent === true,
    consentedAt: typeof data?.consentedAt === "string" ? data.consentedAt : undefined,
  };
}

export async function setAiConsent(accepted: boolean): Promise<ConsentState> {
  const next: ConsentState = accepted
    ? { aiConsent: true, consentedAt: new Date().toISOString() }
    : { aiConsent: false };
  await writeJsonAtomic(CONSENT_FILE, next);
  return next;
}
