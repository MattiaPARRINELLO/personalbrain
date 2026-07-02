import { NextRequest } from "next/server";
import {
  streamChatCompletion,
  type UnifiedMessage,
  type UnifiedTool,
  type StreamEvent,
} from "@/lib/ai-providers";
import { getMemory, addMemoryFact, webSearch, addReminder, addWatchLaterItem, fetchPageMeta } from "@/lib/storage";
import { fetchGmailMessages, sendGmailReply, createGoogleCalendarEvent } from "@/lib/google-actions";
import type { ChatMessage } from "@/lib/types";

const MODELS = {
  general: "deepseek-v4-pro",
  generalAlt: "kimi-k2.6",
  code: "kimi-k2.7-code",
};

const tools: UnifiedTool[] = [
  {
    name: "web_search",
    description: "Effectue une recherche web rapide pour recuperer des informations d'actualite ou des faits generaux.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "La requete de recherche" },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_and_search_emails",
    description: "Recupere les derniers emails de la boite Gmail et permet de chercher par mot-cle dans les expediteurs, sujets ou contenus.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mot-cle de recherche (optionnel)" },
      },
      required: [],
    },
  },
  {
    name: "send_email_response",
    description: "Envoie une reponse a un email existant via Gmail. L'email_id doit provenir de fetch_and_search_emails.",
    parameters: {
      type: "object",
      properties: {
        email_id: { type: "string", description: "ID de l'email auquel repondre" },
        response_text: { type: "string", description: "Texte complet de la reponse a envoyer" },
      },
      required: ["email_id", "response_text"],
    },
  },
  {
    name: "create_calendar_event",
    description: "Cree un evenement dans le vrai Google Calendar.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre de l'evenement" },
        start_time: { type: "string", description: "Date/heure de debut au format ISO 8601" },
        end_time: { type: "string", description: "Date/heure de fin au format ISO 8601" },
        location: { type: "string", description: "Lieu de l'evenement (optionnel)" },
      },
      required: ["title", "start_time", "end_time"],
    },
  },
  {
    name: "add_memory_fact",
    description: "Memorise un fait important sur l'utilisateur pour les futures conversations.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Le fait a memoriser, en francais, a la troisieme personne" },
        category: { type: "string", enum: ["dev", "photo", "life", "preference"], description: "Categorie du fait" },
      },
      required: ["content", "category"],
    },
  },
  {
    name: "add_reminder",
    description: "Cree un rappel avec une date d'echeance ISO 8601. Utilise cet outil quand l'utilisateur veut etre rappele plus tard.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre court du rappel" },
        notes: { type: "string", description: "Details optionnels" },
        due_at: { type: "string", description: "Date d'echeance au format ISO 8601" },
      },
      required: ["title", "due_at"],
    },
  },
  {
    name: "add_watch_later",
    description: "Ajoute un lien (video YouTube, article, photo, musique) a la liste 'A voir plus tard' pour consultation ulterieure.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL complete" },
        title: { type: "string", description: "Titre de l'element" },
        description: { type: "string", description: "Description courte" },
        thumbnail: { type: "string", description: "URL de la miniature (si disponible)" },
        category: { type: "string", enum: ["video", "article", "photo", "music", "other"], description: "Categorie" },
      },
      required: ["url", "title"],
    },
  },
  {
    name: "fetch_page_meta",
    description: "Recupere le titre et la miniature d'une page web ou video YouTube a partir de son URL. Utilise cet outil quand l'utilisateur partage un lien, puis passe les donnees a add_watch_later.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL complete de la page ou video" },
      },
      required: ["url"],
    },
  },
];

async function buildSystemPrompt(context: "general" | "code"): Promise<string> {
  const memory = await getMemory();
  const facts = memory.facts.map((f) => `- [${f.category}] ${f.content}`).join("\n");
  const prefs = memory.profile.preferences.join(", ");

  const base = `Tu es PersonalBrain, l'assistant personnel de ${memory.profile.name}. Tu es concis, utile et francophone. Tu aides sur le code, la photo et l'organisation.`;
  const memoryBlock = `Voici ce que tu sais deja sur ${memory.profile.name} :
Preferences : ${prefs}
Faits memorises :
${facts || "- Aucun fait memorise"}`;

  const codeBlock = context === "code"
    ? "Tu es en mode compagnon de code. Analyse les problemes algorithmiques, propose des solutions en TypeScript, explique la complexite et les cas limites."
    : "";

  return `${base}\n\n${memoryBlock}\n\nTu as acces a des outils : web_search, fetch_and_search_emails, send_email_response, create_calendar_event, add_memory_fact, add_reminder, add_watch_later, fetch_page_meta. Utilise-les quand c'est pertinent. Si l'utilisateur partage un lien (YouTube, article, musique), utilise d'abord fetch_page_meta pour recuperer le titre et la miniature, puis add_watch_later pour l'ajouter en passant la miniature si disponible. Si l'utilisateur veut etre rappele plus tard, utilise add_reminder avec une date ISO 8601.\n${codeBlock}`.trim();
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "web_search": {
      const query = String(args.query ?? "");
      return await webSearch(query);
    }
    case "fetch_and_search_emails": {
      const query = args.query ? String(args.query) : undefined;
      const emails = await fetchGmailMessages(query, 10);
      if (emails.length === 0) return "Aucun email trouve.";
      return emails
        .map(
          (e) =>
            `ID: ${e.id}\nDe: ${e.from}\nSujet: ${e.subject}\nDate: ${e.date}\nExtrait: ${e.snippet}`
        )
        .join("\n\n---\n\n");
    }
    case "send_email_response": {
      const emailId = String(args.email_id ?? "");
      const responseText = String(args.response_text ?? "");
      if (!emailId || !responseText) return "Erreur : email_id et response_text requis.";
      const sentId = await sendGmailReply(emailId, responseText);
      return `Reponse envoyee (message id: ${sentId}).`;
    }
    case "create_calendar_event": {
      const title = String(args.title ?? "");
      const start = String(args.start_time ?? "");
      const end = String(args.end_time ?? "");
      const location = args.location ? String(args.location) : undefined;
      if (!title || !start || !end) return "Erreur : title, start_time et end_time requis.";
      const eventId = await createGoogleCalendarEvent(title, start, end, location);
      return `Evenement "${title}" cree dans Google Calendar (id: ${eventId}).`;
    }
    case "add_memory_fact": {
      const content = String(args.content ?? "");
      const category = String(args.category ?? "life") as "dev" | "photo" | "life" | "preference";
      if (!content) return "Erreur : contenu vide.";
      await addMemoryFact(content, category);
      return `Fait memorise : ${content}`;
    }
    case "add_reminder": {
      const title = String(args.title ?? "");
      const notes = args.notes ? String(args.notes) : undefined;
      const dueAt = String(args.due_at ?? "");
      if (!title || !dueAt) return "Erreur : title et due_at requis.";
      const r = await addReminder({ title, notes, dueAt });
      return `Rappel cree : "${r.title}" pour le ${new Date(r.dueAt).toLocaleString("fr-FR")}.`;
    }
    case "add_watch_later": {
      const url = String(args.url ?? "");
      const title = String(args.title ?? "");
      const description = args.description ? String(args.description) : undefined;
      const thumbnail = args.thumbnail ? String(args.thumbnail) : undefined;
      const category = args.category as "video" | "article" | "photo" | "music" | "other" | undefined;
      if (!url || !title) return "Erreur : url et title requis.";
      const item = await addWatchLaterItem({ url, title, description, thumbnail, category });
      return `Ajoute a 'A voir plus tard' : ${item.title} (${item.source}).`;
    }
    case "fetch_page_meta": {
      const url = String(args.url ?? "");
      if (!url) return "Erreur : url requise.";
      const meta = await fetchPageMeta(url);
      let result = `Titre : ${meta.title}`;
      if (meta.thumbnail) result += `\nMiniature : ${meta.thumbnail}`;
      return result;
    }
    default:
      return `Outil inconnu : ${name}`;
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    messages: ChatMessage[];
    model?: "general" | "code";
  };

  const context = body.model === "code" ? "code" : "general";
  const modelName = context === "code" ? MODELS.code : MODELS.general;
  const altModel = context === "code" ? MODELS.code : MODELS.generalAlt;

  const systemPrompt = await buildSystemPrompt(context);

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
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: StreamEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      const maxIterations = 5;

      async function runModel(model: string): Promise<boolean> {
        const generator = streamChatCompletion(model, messages, tools);
        const toolCallsToExecute: { toolCallId: string; name: string; arguments: string }[] = [];
        let assistantContent = "";

        for await (const event of generator) {
          if (event.type === "tool_start") {
            toolCallsToExecute.push({
              toolCallId: event.toolCallId,
              name: event.name,
              arguments: event.arguments,
            });
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

      try {
        for (let i = 0; i < maxIterations; i++) {
          const useFallback = i > 0;
          const currentModel = useFallback ? altModel : modelName;

          try {
            const shouldContinue = await runModel(currentModel);
            if (!shouldContinue) return;
          } catch {
            if (useFallback || currentModel === altModel) throw new Error(`Le modèle ${currentModel} a échoué après fallback`);
            // Retry with alt model on next iteration
            continue;
          }
        }

        send({ type: "done", content: "" });
        controller.close();
      } catch (error) {
        console.error("Chat stream error:", error);
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        send({ type: "error", message });
        send({ type: "done", content: "" });
        controller.close();
      }
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
