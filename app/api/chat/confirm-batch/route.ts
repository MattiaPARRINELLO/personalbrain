import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { executeTool, REQUIRE_CONFIRMATION } from "@/lib/chat-tools";
import { logActivity } from "@/lib/storage";

// Exécute un LOT d'actions IA exigeant la confirmation utilisateur (outils à
// effet externe : envoi d'email, calendrier, notification, scan d'emails).
// Une seule carte de confirmation est affichée pour le lot ; ce endpoint
// exécute chaque action après le clic « Confirmer tout ». Chaque nom doit
// être dans REQUIRE_CONFIRMATION : jamais de porte d'exécution arbitraire.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { actions?: { name?: unknown; arguments?: unknown }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const actions = Array.isArray(body?.actions) ? body.actions : [];
  if (actions.length === 0) {
    return NextResponse.json({ error: "Aucune action à confirmer" }, { status: 400 });
  }

  const invalid = actions.find((a) => !a || typeof a.name !== "string" || !REQUIRE_CONFIRMATION.has(a.name));
  if (invalid) {
    return NextResponse.json({ error: "Action non confirmable" }, { status: 400 });
  }

  const results: { name: string; ok: boolean; result?: string; error?: string }[] = [];
  for (const action of actions) {
    const name = action.name as string;
    const args =
      action.arguments && typeof action.arguments === "object"
        ? (action.arguments as Record<string, unknown>)
        : {};
    try {
      const result = await executeTool(name, args, true);
      results.push({ name, ok: true, result });
      await logActivity("ai_action", `Action IA exécutée : ${name}`, JSON.stringify(args).slice(0, 150)).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[chat/confirm-batch] Échec de ${name}:`, message);
      await logActivity("ai_action", `Action IA échouée : ${name}`, message).catch(() => {});
      results.push({ name, ok: false, error: message });
    }
  }

  return NextResponse.json({ ok: true, results });
}
