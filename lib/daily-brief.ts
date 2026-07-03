import { promises as fs } from "fs";
import path from "path";
import { getReminders, getConcerts, getEmails } from "./storage";
import { chatCompletion } from "./ai-providers";
import { getConfig } from "./config";
import type { DailyBrief } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const BRIEF_FILE = path.join(DATA_DIR, "daily-briefs.json");

interface DailyBriefsData {
  briefs: DailyBrief[];
}

/**
 * Génère un résumé de la journée en collectant les événements, rappels
 * et emails non lus, puis en les résumant via l'IA.
 * Retourne le texte du brief, ou null si la feature est désactivée.
 */
export async function generateDailyBrief(): Promise<string | null> {
  try {
    const config = await getConfig();
    if (!config.features.dailyBrief) return null;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const [remindersData, concertsData, emailsData] = await Promise.all([
      getReminders(),
      getConcerts(),
      getEmails(),
    ]);

    // Rappels du jour encore pending
    const todayReminders = remindersData.reminders.filter(
      (r) => r.dueAt.slice(0, 10) === today && r.status === "pending"
    );

    // Concerts du jour
    const todayConcerts = concertsData.events.filter((c) => c.date === today);

    // Emails non lus
    const unreadEmails = emailsData.emails.filter((e) => e.unread);

    // Construction de la structure DailyBrief
    const events: DailyBrief["events"] = [
      ...todayConcerts.map((c) => ({
        title: `Concert : ${c.artist} @ ${c.venue}`,
        type: "concert" as const,
      })),
      ...todayReminders.map((r) => ({
        title: r.title,
        type: "reminder" as const,
      })),
    ];

    const reminders: DailyBrief["reminders"] = todayReminders.map((r) => ({
      title: r.title,
      dueAt: r.dueAt,
    }));

    const emails: DailyBrief["emails"] = unreadEmails.map((e) => ({
      from: e.from,
      subject: e.subject,
    }));

    // Construction du prompt pour l'IA
    let prompt = "Résume la journée de Mattia en 3-4 phrases en français :\n";
    if (events.length > 0) {
      prompt += "\nÉvénements du jour :\n" + events.map((e) => `- ${e.title}`).join("\n") + "\n";
    }
    if (emails.length > 0) {
      prompt += "\nEmails non lus :\n" + emails.map((e) => `- ${e.from} : ${e.subject}`).join("\n") + "\n";
    }
    if (events.length === 0 && emails.length === 0) {
      prompt += "\nRien de particulier de prévu aujourd'hui.\n";
    }

    const model = config.models.general;
    const result = await chatCompletion(
      model,
      [
        {
          role: "system",
          content:
            "Tu es PersonalBrain, l'assistant de Mattia. Résume sa journée en 3-4 phrases naturelles en français, sans listes. Sois utile et concis.",
        },
        { role: "user", content: prompt },
      ],
      []
    );

    const summary = result.content.trim() || "Aucun élément notable aujourd'hui.";

    const brief: DailyBrief = {
      date: today,
      summary,
      events,
      reminders,
      emails,
      generatedAt: new Date().toISOString(),
    };

    // Sauvegarde persistante
    await fs.mkdir(DATA_DIR, { recursive: true });
    let existing: DailyBriefsData = { briefs: [] };
    try {
      const raw = await fs.readFile(BRIEF_FILE, "utf-8");
      existing = JSON.parse(raw);
    } catch {
      // Fichier pas encore créé
    }
    existing.briefs.unshift(brief);
    // Garder les 30 derniers jours seulement
    existing.briefs = existing.briefs.slice(0, 30);
    await fs.writeFile(BRIEF_FILE, JSON.stringify(existing, null, 2), "utf-8");

    return summary;
  } catch (err) {
    console.error("[daily-brief] Erreur :", err);
    return null;
  }
}
