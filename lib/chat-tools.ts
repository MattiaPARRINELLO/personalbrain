import type { UnifiedTool } from "@/lib/ai-providers";
import {
  webSearch,
  addReminder,
  updateReminder,
  addWatchLaterItem,
  fetchPageMeta,
  getConcerts,
  getAccreditations,
  getReminders,
  addAccreditation,
  saveAccreditations,
  prepareConcert,
  getWeather,
  getPhotoShoots,
  addPhotoShoot,
  updatePhotoShoot,
  addIntention,
  isSafeFetchUrl,
} from "@/lib/storage";
import type { PhotoShootStatus, Accreditation } from "@/lib/types";
import {
  fetchGmailMessages,
  sendGmailReply,
  createGoogleCalendarEvent,
  fetchGoogleCalendarEvents,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from "@/lib/google-actions";

// Seule l'envoi d'emails exige une confirmation explicite de l'utilisateur
// via /api/chat/confirm. Le modèle ne peut jamais l'exécuter seul. Les autres
// outils (calendrier, rappels, scan, lecture) s'exécutent directement.
export const REQUIRE_CONFIRMATION = new Set<string>(["send_email_response"]);

// Résultat renvoyé au modèle quand une action est bloquée en attente de
// confirmation. Le préfixe permet au client de détecter l'état.
export const ACTION_BLOCKED_PREFIX = "ACTION_BLOCKED:";

export function confirmationMessage(name: string): string {
  return (
    `${ACTION_BLOCKED_PREFIX}${name}. Cette action a un effet externe et exige ` +
    `la confirmation de l'utilisateur. Explique-lui ce que tu veux faire et ` +
    `demande-lui de confirmer. N'exécute PAS l'action toi-meme.`
  );
}

export const tools: UnifiedTool[] = [  {
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
        color_id: { type: "string", description: "Couleur Google Calendar (optionnel). Valeurs : 1=Lavande, 2=Sauge, 3=Raisin, 4=Flamant, 5=Banane, 6=Mandarine, 7=Paon, 8=Graphite, 9=Myrtille, 10=Basilic, 11=Tomate." },
      },
      required: ["title", "start_time", "end_time"],
    },
  },
  {
    name: "update_calendar_event",
    description: "Modifie un evenement existant dans Google Calendar (titre, description, lieu, couleur). Utilise d'abord search_calendar_events pour trouver l'ID de l'evenement.",
    parameters: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "ID Google Calendar de l'evenement a modifier" },
        title: { type: "string", description: "Nouveau titre (optionnel)" },
        description: { type: "string", description: "Nouvelle description (optionnel)" },
        location: { type: "string", description: "Nouveau lieu (optionnel)" },
        color_id: { type: "string", description: "Nouvelle couleur Google Calendar (optionnel). Valeurs : 1=Lavande, 2=Sauge, 3=Raisin, 4=Flamant, 5=Banane, 6=Mandarine, 7=Paon, 8=Graphite, 9=Myrtille, 10=Basilic, 11=Tomate." },
      },
      required: ["event_id"],
    },
  },
  {
    name: "delete_calendar_event",
    description: "Supprime un evenement existant dans Google Calendar. Utilise d'abord search_calendar_events pour trouver l'ID de l'evenement.",
    parameters: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "ID Google Calendar de l'evenement a supprimer" },
      },
      required: ["event_id"],
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
    name: "list_reminders",
    description: "Liste tous les rappels existants avec leur ID, titre et date.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "update_reminder",
    description: "Modifie un rappel existant (titre, notes, date, statut). Necessite l'ID du rappel (utilise list_reminders d'abord pour trouver l'ID).",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID du rappel a modifier" },
        title: { type: "string", description: "Nouveau titre (optionnel)" },
        notes: { type: "string", description: "Nouvelles notes (optionnel)" },
        due_at: { type: "string", description: "Nouvelle date ISO 8601 (optionnel)" },
        status: { type: "string", enum: ["pending", "done", "snoozed"], description: "Nouveau statut (optionnel)" },
      },
      required: ["id"],
    },
  },
  {
    name: "schedule_followup",
    description:
      "Programme une relance future : l'application t'enverra une notification push a la date indiquee pour revenir sur un sujet. Utilise quand l'utilisateur dit 'relance-moi', 'rappelle-moi de faire X', 'reviens vers moi sur Y'.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Sujet court de la relance (ex: 'le dossier UX')" },
        due_at: { type: "string", description: "Moment de la relance en ISO 8601 (ex: '2026-08-08T18:00:00' pour vendredi 18h)" },
        message: { type: "string", description: "Message de relance affiche dans la notification (optionnel)" },
      },
      required: ["subject", "due_at"],
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
  {
    name: "get_weather",
    description: "Recupere la meteo actuelle d'une ville (temperature, ressenti, humidite, vent). Exemple : 'get_weather Paris'.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "Nom de la ville" },
      },
      required: ["city"],
    },
  },
  {
    name: "add_photo_shoot",
    description: "Ajoute un nouveau shooting photo au suivi. Si l'utilisateur ne precise pas de statut, il est automatique : 'done' si la date est passee/aujourd'hui, 'upcoming' si future. Deduis le statut des paroles de l'utilisateur : ex. 'deja sur mon PC' -> 'on_pc', 'photos deja envoyees' -> 'sent', 'retouche' -> 'edited', 'exporte' -> 'exported', 'trie' -> 'sorted', 'fait/termine' -> 'done'. Statuts: upcoming, done, on_pc, sorted, edited, exported, sent.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre du shooting (ex: 'Concert Mariane')" },
        date: { type: "string", description: "Date du shooting au format YYYY-MM-DD" },
        client: { type: "string", description: "Nom du client/artiste" },
        notes: { type: "string", description: "Notes optionnelles" },
        status: { type: "string", enum: ["upcoming", "done", "on_pc", "sorted", "edited", "exported", "sent"], description: "Statut si l'utilisateur le precise, sinon laisse vide pour le comportement automatique" },
      },
      required: ["title", "date", "client"],
    },
  },
  {
    name: "update_photo_shoot",
    description: "Met a jour le statut ou les infos d'un shooting photo. Utilise 'list_photo_shoots' d'abord pour trouver l'ID.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID du shooting" },
        status: { type: "string", enum: ["upcoming", "done", "on_pc", "sorted", "edited", "exported", "sent"], description: "Nouveau statut" },
        galleryLink: { type: "string", description: "Lien galerie (quand status='sent')" },
        photosSent: { type: "number", description: "Nombre de photos envoyees (quand status='sent')" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_photo_shoots",
    description: "Liste tous les shootings photo avec leur statut, date et client.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  confirmed = false
): Promise<string> {
  // Défense en profondeur : même si un appelant oublie le contrôle en amont,
  // une action à effet externe n'est jamais exécutée sans confirmation.
  if (REQUIRE_CONFIRMATION.has(name) && !confirmed) {
    return confirmationMessage(name);
  }
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
      const colorId = args.color_id ? String(args.color_id) : undefined;
      if (!title || !start || !end) return "Erreur : title, start_time et end_time requis.";
      const eventId = await createGoogleCalendarEvent(title, start, end, location, undefined, colorId);
      let msg = `Evenement "${title}" cree dans Google Calendar (id: ${eventId}).`;
      if (colorId) msg += ` Couleur appliquee.`;
      return msg;
    }
    case "update_calendar_event": {
      const eventId = String(args.event_id ?? "");
      if (!eventId) return "Erreur : event_id requis.";
      const updates: { summary?: string; description?: string; location?: string; colorId?: string } = {};
      if (args.title) updates.summary = String(args.title);
      if (args.description) updates.description = String(args.description);
      if (args.location) updates.location = String(args.location);
      if (args.color_id) updates.colorId = String(args.color_id);
      await updateGoogleCalendarEvent(eventId, updates);
      return `Evenement mis a jour (id: ${eventId}).`;
    }
    case "delete_calendar_event": {
      const eventId = String(args.event_id ?? "");
      if (!eventId) return "Erreur : event_id requis.";
      await deleteGoogleCalendarEvent(eventId);
      return `Evenement supprime du Google Calendar (id: ${eventId}).`;
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
    case "list_reminders": {
      const data = await getReminders();
      if (data.reminders.length === 0) return "Aucun rappel pour le moment.";
      return data.reminders
        .map((r) => `- [${r.id}] "${r.title}" → ${new Date(r.dueAt).toLocaleString("fr-FR")} (${r.status})`)
        .join("\n");
    }
    case "update_reminder": {
      const id = String(args.id ?? "");
      if (!id) return "Erreur : id requis. Utilise list_reminders pour trouver l'ID.";
      const updates: Record<string, unknown> = {};
      if (args.title !== undefined) updates.title = String(args.title);
      if (args.notes !== undefined) updates.notes = String(args.notes);
      if (args.due_at !== undefined) updates.dueAt = String(args.due_at);
      if (args.status !== undefined) updates.status = String(args.status);
      const r = await updateReminder(id, updates as Parameters<typeof updateReminder>[1]);
      if (!r) return "Rappel introuvable.";
      return `Rappel modifie : "${r.title}" → ${new Date(r.dueAt).toLocaleString("fr-FR")} (${r.status}).`;
    }
    case "schedule_followup": {
      const subject = String(args.subject ?? "");
      const dueAt = String(args.due_at ?? "");
      const message = args.message ? String(args.message) : undefined;
      if (!subject || !dueAt) return "Erreur : subject et due_at requis.";
      if (Number.isNaN(new Date(dueAt).getTime())) {
        return "Erreur : due_at doit etre une date ISO 8601 valide.";
      }
      const it = await addIntention({ subject, message, dueAt });
      return `Relance programmee : « ${it.subject} » pour le ${new Date(it.dueAt).toLocaleString("fr-FR")}. Tu recevras une notification a ce moment-la.`;
    }
    case "add_watch_later": {
      const url = String(args.url ?? "");
      const title = String(args.title ?? "");
      const description = args.description ? String(args.description) : undefined;
      const thumbnail = args.thumbnail ? String(args.thumbnail) : undefined;
      const category = args.category as "video" | "article" | "photo" | "music" | "other" | undefined;
      if (!url || !title) return "Erreur : url et title requis.";
      if (!(await isSafeFetchUrl(url))) {
        return "Erreur : URL non autorisee (adresse privee ou invalide).";
      }
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
    case "get_weather": {
      const city = String(args.city ?? "").trim();
      if (!city) return "Erreur : ville requise.";
      return await getWeather(city);
    }
    case "add_photo_shoot": {
      const title = String(args.title ?? "").trim();
      const date = String(args.date ?? "").trim();
      const client = String(args.client ?? "").trim();
      const notes = String(args.notes ?? "").trim() || undefined;
      const status = args.status as PhotoShootStatus | undefined;
      if (!title || !date || !client) return "Erreur : titre, date et client requis.";
      const shoot = await addPhotoShoot({ title, date, client, notes, status });
      return `Shooting ajouté : ${shoot.title} (${shoot.client}) le ${new Date(shoot.date).toLocaleDateString("fr-FR")} [${shoot.status}]`;
    }
    case "update_photo_shoot": {
      const id = String(args.id ?? "").trim();
      if (!id) return "Erreur : ID requis.";
      const updates: Record<string, unknown> = {};
      if (args.status) updates.status = args.status;
      if (args.galleryLink) updates.galleryLink = String(args.galleryLink);
      if (args.photosSent !== undefined) updates.photosSent = Number(args.photosSent);
      const updated = await updatePhotoShoot(id, updates as Parameters<typeof updatePhotoShoot>[1]);
      if (!updated) return "Shooting introuvable.";
      return `Shooting mis à jour : ${updated.title} → ${updated.status}${updated.galleryLink ? ` (galerie: ${updated.galleryLink})` : ""}${updated.photosSent ? ` (${updated.photosSent} photos)` : ""}`;
    }
    case "list_photo_shoots": {
      const data = await getPhotoShoots();
      if (data.shoots.length === 0) return "Aucun shooting photo enregistré.";
      return data.shoots.map((s) =>
        `- ${s.title} (${s.client}) le ${new Date(s.date).toLocaleDateString("fr-FR")} [${s.status}]${s.galleryLink ? ` - ${s.galleryLink}` : ""}${s.photosSent ? ` - ${s.photosSent} photos` : ""}`
      ).join("\n");
    }
    default:
      return `Outil inconnu : ${name}`;
  }
}
