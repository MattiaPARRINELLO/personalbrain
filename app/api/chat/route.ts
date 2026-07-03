import { NextRequest } from "next/server";
import {
  streamChatCompletion,
  type UnifiedMessage,
  type UnifiedTool,
  type StreamEvent,
} from "@/lib/ai-providers";
import { getMemory, webSearch, addReminder, addWatchLaterItem, fetchPageMeta, getConcerts } from "@/lib/storage";
import { fetchGmailMessages, sendGmailReply, createGoogleCalendarEvent, fetchGoogleCalendarEvents } from "@/lib/google-actions";
import { getModel } from "@/lib/config";
import type { ChatMessage } from "@/lib/types";

const tools: UnifiedTool[] = [
  {
    name: "web_search",
    description: "Effectue une recherche web pour recuperer des informations d'actualite ou des faits generaux.",
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
    description: "Recupere les derniers emails de la boite Gmail et cherche par mot-cle dans les expediteurs, sujets ou contenus.",
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
    description: "Envoie une reponse a un email existant via Gmail.",
    parameters: {
      type: "object",
      properties: {
        email_id: { type: "string", description: "ID de l'email auquel repondre" },
        response_text: { type: "string", description: "Texte complet de la reponse" },
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
        start_time: { type: "string", description: "Date/heure debut ISO 8601. Pour un evenement toute la journee, utiliser le format date simple YYYY-MM-DD (ex: 2024-01-15)." },
        end_time: { type: "string", description: "Date/heure fin ISO 8601. Pour un evenement toute la journee, utiliser le format date simple YYYY-MM-DD (ex: 2024-01-16 pour un evenement le 15)." },
        location: { type: "string", description: "Lieu (optionnel)" },
      },
      required: ["title", "start_time", "end_time"],
    },
  },
  {
    name: "search_calendar_events",
    description: "Cherche des evenements dans le calendrier Google (concerts, cours, reunions).",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Nombre de jours a chercher (defaut: 30)" },
      },
      required: [],
    },
  },
  {
    name: "lookup_concerts",
    description: "Consulte la liste des concerts en cours (shootes, en selection, en montage, livres).",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "triage_emails",
    description: "Analyse les emails non lus et les classe par priorite (urgent, newsletter, billetterie, personnel).",
    parameters: {
      type: "object",
      properties: {
        max_results: { type: "number", description: "Nombre max d'emails a analyser (defaut: 10)" },
      },
      required: [],
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
    description: "Cree un rappel avec une date d'echeance ISO 8601.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre court du rappel" },
        notes: { type: "string", description: "Details optionnels" },
        due_at: { type: "string", description: "Date d'echeance ISO 8601" },
      },
      required: ["title", "due_at"],
    },
  },
  {
    name: "add_watch_later",
    description: "Ajoute un lien a la liste 'A voir plus tard'.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL complete" },
        title: { type: "string", description: "Titre" },
        description: { type: "string", description: "Description courte" },
        thumbnail: { type: "string", description: "URL miniature" },
        category: { type: "string", enum: ["video", "article", "photo", "music", "other"], description: "Categorie" },
      },
      required: ["url", "title"],
    },
  },
  {
    name: "fetch_page_meta",
    description: "Recupere le titre et la miniature d'une page web ou video YouTube.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL complete" },
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

  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

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
  } catch {
    // Silencieux — le daily brief est optionnel
  }

  return `${base}\n\n${memoryBlock}\n\nAujourd'hui nous sommes le ${dateStr}, il est ${timeStr}.${briefBlock}\n\nTu as acces a ces outils : ${toolList}. Utilise-les quand c'est pertinent.\n\nSi l'utilisateur partage un lien, utilise d'abord fetch_page_meta puis add_watch_later.\n${codeBlock}`.trim();
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "web_search": {
      return await webSearch(String(args.query ?? ""));
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
    case "search_calendar_events": {
      const days = typeof args.days === "number" ? args.days : 30;
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const events = await fetchGoogleCalendarEvents(timeMin, timeMax);
      if (events.length === 0) return "Aucun evenement trouve dans le calendrier.";
      return events
        .map(
          (e) =>
            `- ${e.summary} le ${new Date(e.start).toLocaleDateString("fr-FR")}${e.location ? ` (${e.location})` : ""}`
        )
        .join("\n");
    }
    case "lookup_concerts": {
      const data = await getConcerts();
      if (data.events.length === 0) return "Aucun concert enregistre.";
      return data.events
        .map(
          (c) =>
            `- ${c.artist} @ ${c.venue} le ${new Date(c.date).toLocaleDateString("fr-FR")} [${c.status}]`
        )
        .join("\n");
    }
    case "triage_emails": {
      const maxResults = typeof args.max_results === "number" ? args.max_results : 10;
      const emails = await fetchGmailMessages(undefined, maxResults);
      if (emails.length === 0) return "Aucun email trouve.";
      const urgent = emails.filter((e) => e.unread && /urgent|rappel|relance|deadline|échéance/i.test(e.subject + " " + e.snippet));
      const normal = emails.filter((e) => !urgent.includes(e));
      let result = "";
      if (urgent.length > 0) {
        result += "🔴 URGENT :\n" + urgent.map((e) => `  - ${e.from}: ${e.subject}`).join("\n") + "\n\n";
      }
      result += "📋 Autres emails :\n" + normal.map((e) => `  - ${e.from}: ${e.subject}${e.unread ? " (non lu)" : ""}`).join("\n");
      return result;
    }
    case "add_memory_fact": {
      const content = String(args.content ?? "");
      const category = String(args.category ?? "life") as "dev" | "photo" | "life" | "preference";
      if (!content) return "Erreur : contenu vide.";
      const { addMemoryFact } = await import("@/lib/storage");
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
  const { primary: modelName, alt: altModel } = await getModel(context);

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
