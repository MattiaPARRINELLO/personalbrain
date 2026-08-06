import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import type { Dirent } from "fs";
import path from "path";
import { getSession } from "@/lib/session";

const DATA_DIR = path.join(process.cwd(), "data");

// Fichiers exclus de l'export : secrets d'infra, identifiants d'authentification
// et cache interne. Les données métier (conversations, rappels, mémoire,
// emails en cache, etc.) sont toutes incluses.
const EXCLUDED = new Set([
  ".auth-secret",
  ".gitkeep",
  "users.json", // passkeys (identité d'authentification)
  "gmail-token.json",
  "calendar-token.json",
  "firebase-service-account.json",
  "server-cache.json",
  "notified-reminders.json",
]);

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const files: Record<string, unknown> = {};
  let entries: Dirent[];
  try {
    entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  } catch {
    entries = [];
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (EXCLUDED.has(entry.name)) continue;
    if (!entry.name.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, entry.name), "utf-8");
      files[entry.name] = JSON.parse(raw) as unknown;
    } catch (err) {
      console.warn(`[export] Fichier ignoré (illisible) : ${entry.name}`, err);
    }
  }

  const payload = {
    app: "BACKSTAGE",
    exportedAt: new Date().toISOString(),
    version: 1,
    data: files,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="backstage-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
