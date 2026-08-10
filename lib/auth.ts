import { promises as fs } from "fs";
import path from "path";
import { writeJsonAtomic, readJsonSafe } from "./storage";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const USERS_FILENAME = "users.json";

// Marqueur "bootstrap consommé" : le SETUP_TOKEN ne doit servir qu'une fois.
// Une fois le premier passkey enregistré, le token est inutilisable, même s'il
// fuit. Seul `bun run reset:passkey` réouvre le bootstrap.
export const SETUP_CONSUMED_FILE = path.join(process.cwd(), "data", ".setup-consumed");

export async function markSetupConsumed(): Promise<void> {
  await fs.writeFile(SETUP_CONSUMED_FILE, new Date().toISOString(), "utf-8");
}

export async function isSetupConsumed(): Promise<boolean> {
  try {
    await fs.access(SETUP_CONSUMED_FILE);
    return true;
  } catch {
    return false;
  }
}

export type PasskeyCredential = {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
};

type UserStore = {
  credentials: PasskeyCredential[];
};

const defaultStore: UserStore = { credentials: [] };

async function ensureUsersFile(): Promise<void> {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  try {
    await fs.access(USERS_FILE);
    return;
  } catch {
    // Fichier absent, on l'initialise.
  }
  await writeJsonAtomic(USERS_FILENAME, defaultStore);
}

export async function getUserStore(): Promise<UserStore> {
  await ensureUsersFile();
  try {
    return await readJsonSafe<UserStore>(USERS_FILENAME, defaultStore);
  } catch {
    return defaultStore;
  }
}

export async function saveUserStore(store: UserStore): Promise<void> {
  await writeJsonAtomic(USERS_FILENAME, store);
}

export async function hasCredentials(): Promise<boolean> {
  const store = await getUserStore();
  return store.credentials.length > 0;
}

export async function saveCredential(credential: PasskeyCredential): Promise<void> {
  const store = await getUserStore();
  const existingIndex = store.credentials.findIndex((c) => c.id === credential.id);
  if (existingIndex >= 0) {
    store.credentials[existingIndex] = credential;
  } else {
    store.credentials.push(credential);
  }
  await saveUserStore(store);
}

export async function getCredentialById(id: string): Promise<PasskeyCredential | null> {
  const store = await getUserStore();
  return store.credentials.find((c) => c.id === id) ?? null;
}

export function getRpID(request: Request): string {
  const envRpID = process.env.WEBAUTHN_RP_ID;
  if (envRpID) return envRpID;

  const host = request.headers.get("host") ?? "localhost";
  const hostname = host.split(":")[0];
  return hostname === "localhost" ? "localhost" : hostname;
}

export function getOrigin(request: Request): string {
  const envOrigin = process.env.WEBAUTHN_ORIGIN;
  if (envOrigin) return envOrigin;

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
