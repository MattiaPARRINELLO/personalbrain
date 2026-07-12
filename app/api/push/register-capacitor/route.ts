import { NextResponse } from "next/server";
import { readJsonSafe, writeJsonAtomic } from "@/lib/storage";

interface CapacitorToken {
  token: string;
  platform: string;
  createdAt: string;
}

interface PushSubscriptionsCapacitorData {
  tokens: CapacitorToken[];
}

const FILENAME = "push-subscriptions-capacitor.json";

export async function GET() {
  const data = await readJsonSafe<PushSubscriptionsCapacitorData>(FILENAME, { tokens: [] });
  return NextResponse.json({ count: data.tokens.length });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token: string; platform: string };
    if (!body.token) {
      return NextResponse.json({ error: "token requis" }, { status: 400 });
    }

    const data = await readJsonSafe<PushSubscriptionsCapacitorData>(FILENAME, { tokens: [] });
    const exists = data.tokens.some((t) => t.token === body.token);
    if (!exists) {
      data.tokens.push({
        token: body.token,
        platform: body.platform || "android",
        createdAt: new Date().toISOString(),
      });
      await writeJsonAtomic(FILENAME, data);
      console.log("[register-capacitor] Nouveau token enregistré:", body.token.slice(0, 40) + "...");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[register-capacitor]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
