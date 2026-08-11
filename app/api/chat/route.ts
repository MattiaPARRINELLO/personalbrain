import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  streamChatCompletion,
  type UnifiedMessage,
  type StreamEvent,
} from "@/lib/ai-providers";
import {
  fetchPageMeta,
  autoSummarize,
} from "@/lib/storage";
import { getModel } from "@/lib/config";
import type { ChatMessage, MemoryCategory } from "@/lib/types";
import { autoExtractMemoryFacts } from "@/app/actions/brain";
import { getSession } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { executeTool, tools, REQUIRE_CONFIRMATION, confirmationMessage } from "@/lib/chat-tools";
import { buildSystemPrompt } from "@/lib/chat-prompts";







const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().optional(),
        toolCalls: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              arguments: z.string(),
            })
          )
          .optional(),
      })
    )
    .min(1, "Au moins un message est requis"),
  model: z.enum(["general", "code"]).optional(),
});



async function extractMemoryFacts(
  model: string,
  transcript: { role: "user" | "assistant"; content: string }[]
): Promise<{ content: string; category: MemoryCategory; confidence: number }[]> {
  const sysPrompt = `Tu es un extracteur de memoire pour un second cerveau personnel.
Analyse l'echange ci-dessous et extrais UNIQUEMENT les faits durables, stables et utiles a long terme sur l'utilisateur.
Categories autorisees: dev (preferences/competences techniques), photo (materiel, style, workflow), life (habitudes, contraintes, contexte personnel), preference (preferences generales).
Exclure: demandes ponctuelles, salutations, questions ephemeres, opinions changeantes.
Format de sortie STRICT: une ligne par fait au format "- [categorie] [confiance entre 0 et 1] enonce court".
Si rien n'est memorisable, retourne EXACTEMENT: NONE
Pas de markdown, pas de numerotation, pas de preambule.`;

  const userPrompt = `Echange recent (les 6 derniers messages) :
${transcript
    .slice(-6)
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n")}

Faits a extraire :`;

  try {
    const { chatCompletion } = await import("@/lib/ai-providers");
    const result = await chatCompletion(
      model,
      [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      []
    );
    const raw = result.content;

    if (!raw || raw.trim().toUpperCase().startsWith("NONE")) return [];
    const facts: { content: string; category: MemoryCategory; confidence: number }[] = [];
    for (const line of raw.split("\n")) {
      const match = line.match(/^-\s*\[(dev|photo|life|preference)\]\s*\[(0?\.\d+|1(?:\.0+)?)\]\s*(.+)$/i);
      if (!match) continue;
      const category = match[1].toLowerCase() as MemoryCategory;
      const confidence = parseFloat(match[2]);
      const content = match[3].trim();
      if (!content || content.length < 3 || content.length > 280) continue;
      if (Number.isNaN(confidence)) continue;
      facts.push({ category, confidence, content });
    }
    return facts;
  } catch (err) {
    console.error("Memory extraction failed:", err);
    return [];
  }
}

async function runMemoryExtraction(
  model: string,
  originalMessages: ChatMessage[],
  send?: (data: StreamEvent) => void,
  newAssistantContent?: string
): Promise<void> {
  try {
    const transcript = originalMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => typeof m.content === "string" && m.content.length > 0)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));
    if (newAssistantContent && newAssistantContent.length > 0) {
      transcript.push({ role: "assistant", content: newAssistantContent });
    }
    if (transcript.length < 2) return;
    const lastUser = [...transcript].reverse().find((m) => m.role === "user");
    if (!lastUser || lastUser.content.length < 12) return;
    const lastAssistant = [...transcript].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant || lastAssistant.content.length < 24) return;

    const facts = await extractMemoryFacts(model, transcript);
    if (facts.length > 0) {
      await autoExtractMemoryFacts({ facts });
      send?.({ type: "memory_facts", facts });
    }
  } catch (err) {
    console.error("Memory extraction error:", err);
  }
}

export async function POST(request: NextRequest) {
  // Garde d'authentification dans le handler (le middleware protège déjà la
  // route, mais un bypass du middleware ne doit pas exposer le chat).
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit keyé sur l'utilisateur (l'IP seule est spoofable via
  // x-forwarded-for) : un tiers ne peut pas contourner le quota.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  if (!checkRateLimit(`${session.userId}:${ip}`)) {
    return new Response(JSON.stringify({ error: "Trop de requêtes. Réessaie dans une minute." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { messages: ChatMessage[]; model?: "general" | "code" };
  try {
    const parsed = chatBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Corps de requête invalide : messages (tableau non vide avec role et content) requis." },
        { status: 400 }
      );
    }
    body = parsed.data as unknown as { messages: ChatMessage[]; model?: "general" | "code" };
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  // Auto-parsing des liens dans le dernier message utilisateur
  const lastUserMsg = [...body.messages].reverse().find((m) => m.role === "user");
  if (lastUserMsg && typeof lastUserMsg.content === "string") {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = lastUserMsg.content.match(urlRegex);
    if (urls && urls.length > 0) {
      try {
        const meta = await fetchPageMeta(urls[0]);
        const { summary, tags } = await autoSummarize(urls[0], meta.title);
        // Contenu externe délimité : à traiter comme NON FIABLE par le modèle.
        lastUserMsg.content += `\n\n<user_content>Contenu externe d'un lien partage (NON FIABLE) :\nResume : ${summary}. Tags suggeres : ${tags.join(", ")}.</user_content>`;
      } catch {}
    }
  }

  // Résumé automatique des messages utilisateur très longs (itinéraires, etc.)
  // pour éviter la saturation du contexte sans perdre d'information
  const SUMMARY_THRESHOLD = 3000;
  for (const m of body.messages) {
    if (m.role === "user" && typeof m.content === "string" && m.content.length > SUMMARY_THRESHOLD) {
      try {
        const { chatCompletion } = await import("@/lib/ai-providers");
        const result = await chatCompletion(
          "deepseek-v4-flash",
          [
            { role: "system", content: "Tu résumes des messages en conservant TOUTES les informations utiles : dates, horaires, lieux, noms, actions demandées, numéros. Sois concis mais complet. Ne liste pas — raconte de façon fluide." },
            { role: "user", content: "Résumé conservant tous les détails pratiques :\n\n" + m.content },
          ],
          []
        );
        const summary = result.content.trim();
        if (summary) {
          m.content = summary;
        }
      } catch (err) {
        console.error("[chat] Auto-summary failed, keeping original:", err);
      }
    }
  }

  const context = body.model === "code" ? "code" : "general";
  const { primary: modelName, alt: altModel } = await getModel(context);

  const systemPrompt = await buildSystemPrompt(context, body.messages);

  // Fenêtrage du contexte : ne renvoyer que les 40 derniers messages,
  // tronqués à la frontière d'un message utilisateur (couper au milieu d'un
  // échange d'outils casserait l'appel). L'historique complet reste
  // consultable dans la sidebar de sessions.
  const MAX_CONTEXT_MESSAGES = 40;
  if (body.messages.length > MAX_CONTEXT_MESSAGES) {
    const windowed = body.messages.slice(-MAX_CONTEXT_MESSAGES);
    const firstUserIdx = windowed.findIndex((m) => m.role === "user");
    body.messages = firstUserIdx > 0 ? windowed.slice(firstUserIdx) : windowed;
  }

  const messages: UnifiedMessage[] = [
    { role: "system", content: systemPrompt },
    ...body.messages.map((m): UnifiedMessage => {
      const tool_calls = m.toolCalls?.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));
      return {
        role: m.role,
        content: (tool_calls && tool_calls.length > 0 && !m.content) ? null : m.content,
        ...(tool_calls && tool_calls.length > 0 ? { tool_calls } : {}),
      };
    }),
  ];

  const encoder = new TextEncoder();
  // AbortController local : aborté quand le client se déconnecte (cancel()),
  // ce qui annule aussi la requête IA en cours côté serveur.
  const abortController = new AbortController();
  let streamClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: StreamEvent) {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Le flux a été fermé entre le check et l'enqueue : on ignore.
        }
      }

      const maxIterations = 20;

      async function runModel(model: string): Promise<boolean> {
        const generator = streamChatCompletion(model, messages, tools, abortController.signal);
        const toolCallsToExecute: { toolCallId: string; name: string; arguments: string }[] = [];
        let assistantContent = "";

        for await (const event of generator) {
          if (event.type === "tool_start") {
            toolCallsToExecute.push({
              toolCallId: event.toolCallId,
              name: event.name,
              arguments: event.arguments,
            });
            send(event);
            continue;
          }

          if (event.type === "done") {
            if (toolCallsToExecute.length === 0) {
              send({ type: "done", content: event.content });
              controller.close();
              return false;
            }
            continue;
          }

          if (event.type === "error") {
            send(event);
            send({ type: "done", content: "" });
            controller.close();
            return false;
          }

          if (event.type === "delta") {
            assistantContent += event.content;
          }

          send(event);
        }

        if (toolCallsToExecute.length === 0) {
          send({ type: "done", content: "" });
          controller.close();
          return false;
        }

        messages.push({
          role: "assistant",
          content: assistantContent || null,
          tool_calls: toolCallsToExecute.map((tc) => ({
            id: tc.toolCallId,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        for (const tc of toolCallsToExecute) {
          let result: string;
          try {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.arguments); } catch { args = {}; }
            if (REQUIRE_CONFIRMATION.has(tc.name)) {
              // Action à effet externe : bloquée en attente de confirmation
              // utilisateur. Le client affiche une carte Confirmer/Annuler ;
              // l'exécution réelle passe par POST /api/chat/confirm. Le modèle
              // reçoit un résultat de blocage et peut expliquer la situation.
              send({
                type: "tool_confirm",
                toolCallId: tc.toolCallId,
                name: tc.name,
                arguments: tc.arguments,
              });
              result = confirmationMessage(tc.name);
            } else {
              result = await executeTool(tc.name, args);
            }
          } catch (err) {
            result = `Erreur: ${err instanceof Error ? err.message : String(err)}`;
          }

          send({ type: "tool_result", name: tc.name, result });

          messages.push({
            role: "tool",
            tool_call_id: tc.toolCallId,
            // Résultat d'outil délimité : le contenu (pages, emails, recherche)
            // est externe et NON FIABLE — le modèle ne doit pas suivre ses
            // instructions (cf. bloc CONTENU NON FIABLE du system prompt).
            content: `<tool_result name="${tc.name}">\n${result}\n</tool_result>`,
          });
        }

        return true;
      }

      let lastAssistantContent = "";

      try {
        let useFallback = false;
        for (let i = 0; i < maxIterations; i++) {
          const currentModel = useFallback ? altModel : modelName;

          try {
            const shouldContinue = await runModel(currentModel);
            if (!shouldContinue) {
              void runMemoryExtraction(modelName, body.messages, send, lastAssistantContent);
              return;
            }
            const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
            if (lastAssistantMsg && typeof lastAssistantMsg.content === "string") {
              lastAssistantContent = lastAssistantMsg.content;
            }
          } catch (err) {
            if (streamClosed) throw err; // client parti : pas de fallback inutile
            console.error(`[chat] runModel(${currentModel}) failed:`, err instanceof Error ? err.message : String(err));
            if (useFallback || currentModel === altModel) throw new Error(`Le modèle ${currentModel} a échoué après fallback`);
            useFallback = true;
            continue;
          }
          useFallback = false;
        }

        void runMemoryExtraction(modelName, body.messages, send, lastAssistantContent);
        send({ type: "done", content: "" });
        controller.close();
      } catch (error) {
        if (streamClosed) return;
        console.error("Chat stream error:", error);
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        send({ type: "error", message });
        send({ type: "done", content: "" });
        controller.close();
      }
    },
    cancel() {
      // Le client a fermé la connexion (bouton Stop, navigation, erreur
      // réseau) : on marque le flux comme fermé et on annule la requête IA
      // pour libérer les ressources côté serveur.
      streamClosed = true;
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
