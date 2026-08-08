import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  streamChatCompletion,
  type UnifiedMessage,
  type StreamEvent,
} from "@/lib/ai-providers";
import {
  getMemory,
  fetchPageMeta,
  getReminders,
  getCalendar,
  autoSummarize,
  getPhotoShoots,
  getChatHistory,
} from "@/lib/storage";
import { getModel } from "@/lib/config";
import type { ChatMessage, MemoryCategory } from "@/lib/types";
import { autoExtractMemoryFacts } from "@/app/actions/brain";
import { getSession } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { executeTool, tools } from "@/lib/chat-tools";



// Mémoire de ton (légère) : adapte le ton de l'assistant à l'usage récent et
// à l'humeur détectée dans les derniers messages. Aucun état persistant :
// c'est une analyse statique de la conversation en cours + de l'historique.
async function buildToneBlock(messages: ChatMessage[]): Promise<string> {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .filter((s) => s.length > 0);

  // 1. Humeur détectée dans la conversation courante
  let mood: { label: string; instruction: string } | null = null;
  if (userMessages.length > 0) {
    const last = userMessages[userMessages.length - 1] ?? "";
    const all = userMessages.join(" ").toLowerCase();
    if (/(fatigu|crev|epuis|épuis|galere|galère|stress|énerve|énerv|relou|saoule)/.test(all)) {
      mood = {
        label: "tu sembles fatigue ou sous pression",
        instruction: "Sois empathique et tres concis. Pas de blabla, propose directement l'action qui aide.",
      };
    } else if (last.length > 0 && last.length < 60 && !/[?!]/.test(last)) {
      mood = {
        label: "tu es tres concis",
        instruction: "Reponds court et direct, sans introduction ni question ouverte inutile.",
      };
    } else if (/(super|genial|génial|merci|trop bien|parfait|bravo|excellent)/.test(all)) {
      mood = {
        label: "l'echange est positif",
        instruction: "Ton chaleureux, garde une pointe d'enthousiasme.",
      };
    }
  }

  // 2. Usage sur les 14 derniers jours (chat-history)
  let usage: { label: string; instruction: string } | null = null;
  try {
    const history = await getChatHistory();
    const cutoff = Date.now() - 14 * 86400000;
    const recentUserMsgs = history.sessions
      .flatMap((s) => s.messages)
      .filter((m) => m.role === "user" && new Date(m.timestamp).getTime() >= cutoff);
    const count = recentUserMsgs.length;
    const lastTs = recentUserMsgs.reduce((max, m) => Math.max(max, new Date(m.timestamp).getTime()), 0);
    const daysSinceLast = lastTs > 0 ? (Date.now() - lastTs) / 86400000 : 0;

    if (count === 0) {
      usage = {
        label: "premier contact recent",
        instruction: "Ton factuel et sobre, tu fais connaissance.",
      };
    } else if (daysSinceLast > 3) {
      usage = {
        label: `pas de discussion depuis ${Math.round(daysSinceLast)} jour(s)`,
        instruction: "Ton factuel, va droit au but, pas de familiarite excessive.",
      };
    } else if (count >= 10) {
      usage = {
        label: "usage regulier",
        instruction: "Ton chaleureux et complice.",
      };
    } else {
      usage = {
        label: "usage occasionnel",
        instruction: "Ton cordial et efficace.",
      };
    }
  } catch {
    // Historique illisible : pas de bloc de ton.
  }

  // 3. Heure tardive
  const hour = new Date().getHours();
  const late = hour >= 22 || hour < 6;

  const parts: string[] = [];
  if (mood) parts.push(`Humeur recente : ${mood.label}. ${mood.instruction}`);
  if (usage) parts.push(`Relation : ${usage.label}. ${usage.instruction}`);
  if (late) parts.push("Il est tard : sois concis, evite les questions ouvertes.");

  if (parts.length === 0) return "";
  return `\nÉtat relationnel : ${parts.join(" ")}`;
}

async function buildSystemPrompt(context: "general" | "code", recentMessages: ChatMessage[] = []): Promise<string> {
  const memory = await getMemory();
  const prefs = memory.profile.preferences.join(", ");

  // Top 10 faits les plus pertinents
  const sortedFacts = [...memory.facts].sort((a, b) => {
    const aScore = (a.accessCount ?? 0) + (a.lastAccessedAt ? Date.parse(a.lastAccessedAt) / 1e12 : 0);
    const bScore = (b.accessCount ?? 0) + (b.lastAccessedAt ? Date.parse(b.lastAccessedAt) / 1e12 : 0);
    return bScore - aScore;
  });
  const topFacts = sortedFacts.slice(0, 10);
  const factsBlock = topFacts.map((f) => `- [${f.category}] ${f.content}`).join("\n");

  const base = `Tu es Backstage, l'assistant personnel de ${memory.profile.name}. Tu es concis, utile et francophone. Tu aides sur le code, la photo et l'organisation.`;
  const memoryBlock = `Voici ce que tu sais deja sur ${memory.profile.name} :
Preferences : ${prefs}
Faits memorises recents :
${factsBlock || "- Aucun fait memorise"}`;

  const codeBlock = context === "code"
    ? "Tu es en mode compagnon de code. Analyse les problemes algorithmiques, propose des solutions en TypeScript, explique la complexite et les cas limites."
    : "";

  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  // Evenements du jour et du lendemain
  let eventsBlock = "";
  try {
    const events = await getCalendar();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
    const todayEvents = events.filter((e) => e.date.startsWith(today));
    const tomorrowEvents = events.filter((e) => e.date.startsWith(tomorrow));
    if (todayEvents.length > 0) {
      eventsBlock += "\nEvenements aujourd'hui :\n" + todayEvents.map((e) => `- ${e.title} (${e.venue ?? "lieu inconnu"})`).join("\n");
    }
    if (tomorrowEvents.length > 0) {
      eventsBlock += "\nEvenements demain :\n" + tomorrowEvents.map((e) => `- ${e.title} (${e.venue ?? "lieu inconnu"})`).join("\n");
    }
  } catch {}

  // Shooting photos en cours
  let photoBlock = "";
  try {
    const shoots = await getPhotoShoots();
    const active = shoots.shoots.filter(
      (s) => s.status !== "sent"
    );
    if (active.length > 0) {
      photoBlock = "\nShooting photos en cours :\n" + active.map(
        (s) => `- ${s.title} (${s.client}) [${s.status}]`
      ).join("\n");
    }
  } catch {}

  // 5 derniers rappels pending
  let remindersBlock = "";
  try {
    const reminders = await getReminders();
    const pendingReminders = reminders.reminders
      .filter((r) => r.status === "pending")
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .slice(0, 5);
    if (pendingReminders.length > 0) {
      remindersBlock = "\nRappels en attente :\n" + pendingReminders.map(
        (r) => `- ${r.title} (échéant le ${new Date(r.dueAt).toLocaleDateString("fr-FR")})`
      ).join("\n");
    }
  } catch {}

  const toolList = tools.map((t) => t.name).join(", ");

  // Daily Brief contextuel
  let briefBlock = "";
  try {
    const { getConfig } = await import("@/lib/config");
    const config = await getConfig();
    if (config.features.dailyBrief) {
      const { generateDailyBrief } = await import("@/lib/daily-brief");
      const brief = await generateDailyBrief();
      if (brief) briefBlock = `\n\nBrief du jour : ${brief}`;
    }
  } catch {}

  return `${base}\n\n${memoryBlock}\n\nAujourd'hui nous sommes le ${dateStr}, il est ${timeStr}.${eventsBlock}${photoBlock}${remindersBlock}${briefBlock}${await buildToneBlock(recentMessages)}\n\nTu as acces a ces outils : ${toolList}. Quand l'utilisateur te demande une action concrete (creer un evenement, envoyer un email, ajouter un rappel, etc.), tu DOIS utiliser l'outil correspondant — ne te contente JAMAIS de dire que tu vas le faire sans l'appeler. Tu peux appeler plusieurs outils dans le meme message pour creer des evenements en lot.\n\nSi l'utilisateur partage un lien, utilise d'abord fetch_page_meta puis add_watch_later.\nQuand l'utilisateur demande plusieurs rappels/taches a faire, cree UN rappel par tache (plusieurs appels add_reminder). Ne regroupe jamais plusieurs taches dans un seul rappel.\nSi l'utilisateur demande d'etre relance ou rappele plus tard ('relance-moi', 'rappelle-moi de faire X', 'reviens vers moi sur Y'), utilise schedule_followup pour programmer la relance plutot qu'un simple add_reminder.\nNe supprime ou ne modifie JAMAIS les donnees de l'utilisateur sans son consentement explicite.\nPrefere les tirets courts (-) aux tirets longs (—, em-dash).\n${codeBlock}`.trim();
}

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
        lastUserMsg.content += `\n\n[Ce message contient un lien. Resume : ${summary}. Tags suggeres : ${tags.join(", ")}.`;
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
            result = await executeTool(tc.name, args);
          } catch (err) {
            result = `Erreur: ${err instanceof Error ? err.message : String(err)}`;
          }

          send({ type: "tool_result", name: tc.name, result });

          messages.push({
            role: "tool",
            tool_call_id: tc.toolCallId,
            content: result,
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
