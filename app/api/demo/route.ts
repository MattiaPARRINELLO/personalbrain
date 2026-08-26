import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientConfig } from "@/lib/ai-providers/config";
import {
  DEMO_SYSTEM_PROMPT,
  buildDemoContext,
  selectSources,
} from "@/lib/landing/demo-context";

// ============================================================
// MINI-DÉMO PUBLIQUE — endpoint strictement limité.
// - DeepSeek appelé UNIQUEMENT côté serveur (clé jamais exposée)
// - contexte 100 % fictif, aucune donnée utilisateur réelle
// - aucun outil, aucun storage, aucune session privée
// - rate limiting par IP, timeout court, entrée bornée
// ============================================================

const bodySchema = z.object({
  message: z.string().trim().min(1, "Message requis").max(400, "Message trop long"),
});

const DEMO_MODEL = "deepseek-v4-flash"; // modèle le plus léger du provider
const DEMO_MAX_TOKENS = 350;
const DEMO_TIMEOUT_MS = 20_000;
const RATE_LIMIT = 8; // demandes / minute / IP
const MAX_CONTEXT_CHARS = 2_000;

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "inconnu";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  if (!checkRateLimit(`demo:${ip}`, RATE_LIMIT)) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessayez dans un instant." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400 }
    );
  }

  const message = parsed.data.message;
  const sources = selectSources(message);

  let client: OpenAI;
  try {
    client = new OpenAI(getClientConfig());
  } catch {
    console.error("[demo] Configuration IA absente");
    return NextResponse.json(
      { error: "Démonstration indisponible" },
      { status: 503 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEMO_TIMEOUT_MS);

  try {
    const completion = await client.chat.completions.create(
      {
        model: DEMO_MODEL,
        messages: [
          { role: "system", content: DEMO_SYSTEM_PROMPT },
          { role: "system", content: buildDemoContext().slice(0, MAX_CONTEXT_CHARS) },
          { role: "user", content: message },
        ],
        temperature: 0.4,
        max_tokens: DEMO_MAX_TOKENS,
      },
      { signal: controller.signal, timeout: DEMO_TIMEOUT_MS }
    );

    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!reply) {
      return NextResponse.json(
        { error: "Réponse vide du modèle. Réessayez." },
        { status: 502 }
      );
    }

    // Journalisation sans contenu utilisateur (ni question, ni réponse).
    console.log(`[demo] ok ip=${ip.slice(0, 8)} chars=${reply.length}`);
    return NextResponse.json({ reply, sources });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    console.error(`[demo] échec ip=${ip.slice(0, 8)} ${aborted ? "timeout" : "erreur provider"}`);
    return NextResponse.json(
      { error: aborted
        ? "La démonstration a mis trop de temps à répondre. Réessayez."
        : "La démonstration est momentanément indisponible. Réessayez." },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
