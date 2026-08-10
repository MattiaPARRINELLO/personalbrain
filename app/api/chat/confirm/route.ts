import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { executeTool, REQUIRE_CONFIRMATION } from "@/lib/chat-tools";
import { logActivity } from "@/lib/storage";

// Exécute une action IA qui exige une confirmation utilisateur (outils à
// effet externe : envoi d'email, calendrier, notification, scan d'emails).
// Seul le client, après un clic "Confirmer" sur la carte d'action du chat,
// peut déclencher l'exécution : le modèle ne peut jamais confirmer lui-même.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { name?: string; arguments?: Record<string, unknown> };
  try {
    body = (await request.json()) as { name?: string; arguments?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name : "";
  const args =
    body?.arguments && typeof body.arguments === "object"
      ? (body.arguments as Record<string, unknown>)
      : {};

  // Seuls les outils marqués sont exécutables via cette route : elle ne doit
  // jamais devenir une porte d'exécution arbitraire des outils.
  if (!REQUIRE_CONFIRMATION.has(name)) {
    return NextResponse.json({ error: "Action non confirmable" }, { status: 400 });
  }

  try {
    const result = await executeTool(name, args, true);
    const details = JSON.stringify(args).slice(0, 150);
    await logActivity("ai_action", `Action IA exécutée : ${name}`, details).catch(() => {});
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[chat/confirm] Échec de ${name}:`, message);
    await logActivity("ai_action", `Action IA échouée : ${name}`, message).catch(() => {});
    return NextResponse.json({ error: "L'action a échoué côté serveur" }, { status: 500 });
  }
}
