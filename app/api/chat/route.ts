import { NextRequest } from "next/server";
import {
  streamChatCompletion,
  type UnifiedMessage,
  type UnifiedTool,
  type StreamEvent,
} from "@/lib/ai-providers";
import { getMemory, webSearch, addReminder, addWatchLaterItem, fetchPageMeta, getConcerts, getAccreditations, getReminders, getCalendar, addMemoryRelationship, getMemoryRelationships, addAccreditation, searchAccreditations, autoSummarize, saveAccreditations, prepareConcert } from "@/lib/storage";
import { fetchGmailMessages, sendGmailReply, createGoogleCalendarEvent, fetchGoogleCalendarEvents } from "@/lib/google-actions";
import { getModel } from "@/lib/config";
import type { ChatMessage, MemoryCategory, Accreditation } from "@/lib/types";
import { autoExtractMemoryFacts } from "@/app/actions/brain";

const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimitMap.get(ip);

  if (!existing) {
    rateLimitMap.set(ip, { tokens: RATE_LIMIT_MAX - 1, lastRefill: now });
    return true;
  }

  const elapsed = now - existing.lastRefill;
  const refill = Math.floor((elapsed / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_MAX);
  if (refill > 0) {
    existing.tokens = Math.min(existing.tokens + refill, RATE_LIMIT_MAX);
    existing.lastRefill = now;
  }

  if (existing.tokens <= 0) return false;
  existing.tokens--;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateLimitMap) {
    if (now - bucket.lastRefill > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 60_000).unref();

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
  {
    name: "scan_accreditations",
    description: "Analyse les emails Gmail pour trouver des demandes d'accreditation (mots-cles: accreditation, photo pass, press). Extrait artiste, lieu, date, statut et cree/met a jour les fiches dans accreditations.json.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "prepare_concert",
    description: "Prepare un concert : recupere la meteo, les infos de la salle, et genere une checklist photo personnalisee.",
    parameters: {
      type: "object",
      properties: {
        concertId: { type: "string", description: "ID du concert" },
      },
      required: ["concertId"],
    },
  },
];

async function buildSystemPrompt(context: "general" | "code"): Promise<string> {
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

  // Accreditations en attente
  let accreditationsBlock = "";
  try {
    const accreditations = await getAccreditations();
    const pending = accreditations.accreditations.filter(
      (a: Accreditation) => a.status === "pending" || a.status === "sent"
    );
    if (pending.length > 0) {
      accreditationsBlock = "\nAccreditations en attente :\n" + pending.map(
        (a: Accreditation) => `- ${a.artist} @ ${a.venue} (${a.concertDate}) [${a.status}]`
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

  return `${base}\n\n${memoryBlock}\n\nAujourd'hui nous sommes le ${dateStr}, il est ${timeStr}.${eventsBlock}${accreditationsBlock}${remindersBlock}${briefBlock}\n\nTu as acces a ces outils : ${toolList}. Utilise-les quand c'est pertinent.\n\nSi l'utilisateur partage un lien, utilise d'abord fetch_page_meta puis add_watch_later.\n\nNote : utilise scan_accreditations pour analyser les emails et mettre à jour les accreditations automatiquement.\n${codeBlock}`.trim();
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
    case "scan_accreditations": {
      try {
        const messages = await fetchGmailMessages("accréditation OR photo pass OR press OR accredit", 20);
        if (messages.length === 0) return "Aucun email d'accreditation trouve.";

        let created = 0;
        let updated = 0;
        const existing = await getAccreditations();
        const existingKeys = new Set(
          existing.accreditations.map((a: Accreditation) => `${a.artist}|${a.venue}`.toLowerCase())
        );

        for (const msg of messages) {
          const subj = msg.subject ?? "";
          const from = msg.from ?? "";
          const body = msg.snippet ?? "";
          const text = `${subj} ${body}`.toLowerCase();

          const artistMatch = text.match(/(?:pour|concert de|show de|photo de)\s+([a-zàâçéèêëîïôûùüÿñæœ-]+(?:\s+[a-zàâçéèêëîïôûùüÿñæœ-]+){0,2})/i);
          const venueMatch = text.match(/(?:au|à|chez)\s+([a-zàâçéèêëîïôûùüÿñæœ-]+(?:\s+[a-zàâçéèêëîïôûùüÿñæœ-]+){0,2})/i);
          const dateMatch = text.match(/(\d{1,2})[\/\s](janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|\d{1,2})[\/\s](\d{4}|\d{2})/i);

          const artist = artistMatch ? artistMatch[1].trim() : "";
          const venue = venueMatch ? venueMatch[1].trim() : "";
          const concertDate = dateMatch ? dateMatch[0].trim() : "";

          if (!artist) continue;

          let status: Accreditation["status"] = "pending";
          if (text.includes("accepté") || text.includes("confirme") || text.includes("approved")) {
            status = "accepted";
          } else if (text.includes("refusé") || text.includes("decliné") || text.includes("denied")) {
            status = "refused";
          } else if (text.includes("envoyé") || text.includes("sent") || text.includes("demande")) {
            status = "sent";
          }

          const key = `${artist}|${venue || "inconnu"}`.toLowerCase();
          if (existingKeys.has(key)) {
            const idx = existing.accreditations.findIndex(
              (a: Accreditation) => `${a.artist}|${a.venue}`.toLowerCase() === key
            );
            if (idx >= 0 && existing.accreditations[idx].status !== status) {
              existing.accreditations[idx].status = status;
              existing.accreditations[idx].updatedAt = new Date().toISOString();
              existing.accreditations[idx].emailThreadId = msg.id;
              updated++;
            }
          } else {
            const newAcc = await addAccreditation({
              artist,
              venue: venue || "Inconnu",
              concertDate: concertDate || "Date inconnue",
              contactEmail: from,
            });
            if (status !== "pending") {
              const { updateAccreditation } = await import("@/lib/storage");
              await updateAccreditation(newAcc.id, { status, notes: `Email: ${msg.id}` });
            }
            created++;
            existingKeys.add(key);
          }
        }

        if (updated > 0) {
          await saveAccreditations(existing);
        }

        return `Scan termine : ${created} nouvelle(s) accreditation(s) creee(s), ${updated} mise(s) a jour.`;
      } catch (err) {
        return `Erreur lors du scan des accreditations : ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    case "prepare_concert": {
      const concertId = String(args.concertId ?? "");
      if (!concertId) return "Erreur : ID du concert requis.";
      try {
        const prep = await prepareConcert(concertId);
        return [
          `**Météo :** ${prep.weather}`,
          `**Infos salle :** ${prep.venueInfo}`,
          `**Checklist sac photo :**`,
          ...prep.checklist.map((c) => `- ${c}`),
          `**Conseils trajet :**`,
          ...prep.travelTips.map((t) => `- ${t}`),
        ].join("\n");
      } catch (err) {
        return `Erreur : ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    default:
      return `Outil inconnu : ${name}`;
  }
}

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
  originalMessages: ChatMessage[]
): Promise<void> {
  try {
    const transcript = originalMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => typeof m.content === "string" && m.content.length > 0)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));
    if (transcript.length < 2) return;
    const lastUser = [...transcript].reverse().find((m) => m.role === "user");
    if (!lastUser || lastUser.content.length < 12) return;
    const lastAssistant = [...transcript].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant || lastAssistant.content.length < 24) return;

    const facts = await extractMemoryFacts(model, transcript);
    if (facts.length > 0) {
      await autoExtractMemoryFacts({ facts });
    }
  } catch (err) {
    console.error("Memory extraction error:", err);
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Trop de requêtes. Réessaie dans une minute." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await request.json()) as {
    messages: ChatMessage[];
    model?: "general" | "code";
  };

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
            if (!shouldContinue) {
              void runMemoryExtraction(modelName, body.messages);
              return;
            }
          } catch {
            if (useFallback || currentModel === altModel) throw new Error(`Le modèle ${currentModel} a échoué après fallback`);
            continue;
          }
        }

        void runMemoryExtraction(modelName, body.messages);
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
