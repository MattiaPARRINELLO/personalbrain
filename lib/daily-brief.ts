import { getReminders, getConcerts, getEmails, getLeetcode, getCalendar, writeJsonAtomic, readJsonSafe, prepareConcert } from "./storage";
import { chatCompletion } from "./ai-providers";
import { getConfig } from "./config";
import type { DailyBrief } from "./types";

const BRIEF_FILENAME = "daily-briefs.json";

interface DailyBriefsData {
  briefs: DailyBrief[];
}

export async function generateDailyBrief(): Promise<string | null> {
  try {
    const config = await getConfig();
    if (!config.features.dailyBrief) return null;

    const today = new Date().toISOString().slice(0, 10);

    const [remindersData, concertsData, emailsData, leetcodeData, calendarEvents] = await Promise.all([
      getReminders(),
      getConcerts(),
      getEmails(),
      getLeetcode(),
      getCalendar().catch(() => []),
    ]);

    // Rappels du jour encore pending
    const todayReminders = remindersData.reminders.filter(
      (r) => r.dueAt.slice(0, 10) === today && r.status === "pending"
    );

    // Concerts du jour
    const todayConcerts = concertsData.events.filter((c) => c.date === today);

    // Agenda du jour depuis le calendrier
    const todayAgenda = calendarEvents.filter(
      (e) => e.date.slice(0, 10) === today
    );

    // Emails non lus + urgents
    const unreadEmails = emailsData.emails.filter((e) => e.unread);
    const urgentEmails = unreadEmails.filter(
      (e) => e.triage?.priority === "urgent"
    );

    // LeetCode
    const leetcodeDaily = leetcodeData.exercises.length > 0
      ? leetcodeData.exercises[0]
      : null;

    // Météo du jour (via OpenWeatherMap)
    let weather = "";
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=Paris&appid=${apiKey}&units=metric&lang=fr`
        );
        if (res.ok) {
          const w = await res.json() as { main: { temp: number; feels_like: number }; weather: { description: string }[] };
          weather = `${w.main.temp}°C (ressenti ${w.main.feels_like}°C), ${w.weather[0].description}`;
        }
      } catch {}
    }

    // Concert checklist si applicable
    let concertChecklist: string[] | undefined;
    if (todayConcerts.length > 0) {
      try {
        const prep = await prepareConcert(todayConcerts[0].id);
        concertChecklist = prep.checklist;
      } catch {}
    }

    // Construction du prompt
    let prompt = "Résume la journée de Mattia en 3-4 phrases en français :\n";

    if (todayAgenda.length > 0) {
      prompt += "\nAgenda :\n" + todayAgenda.map((e) => `- ${e.title}`).join("\n") + "\n";
    }
    if (todayConcerts.length > 0) {
      prompt += "\nConcerts aujourd'hui :\n" + todayConcerts.map((c) => `- ${c.artist} @ ${c.venue}`).join("\n") + "\n";
    }
    if (todayReminders.length > 0) {
      prompt += "\nRappels du jour :\n" + todayReminders.map((r) => `- ${r.title} (${r.dueAt.slice(11, 16)})`).join("\n") + "\n";
    }
    if (urgentEmails.length > 0) {
      prompt += "\nEmails urgents :\n" + urgentEmails.map((e) => `- ${e.from} : ${e.subject}`).join("\n") + "\n";
    }
    if (unreadEmails.length > 0 && urgentEmails.length === 0) {
      prompt += `\n${unreadEmails.length} email(s) non lu(s).\n`;
    }
    if (leetcodeDaily) {
      prompt += `\nDernier exercice LeetCode : ${leetcodeDaily.title} (${leetcodeDaily.difficulty})\n`;
    }
    if (weather) {
      prompt += `\nMétéo du jour à Paris : ${weather}\n`;
    }

    if (todayConcerts.length === 0 && todayReminders.length === 0 && urgentEmails.length === 0) {
      prompt += "\nRien de particulier de prévu aujourd'hui.\n";
    }

    const model = config.models.general;
    const result = await chatCompletion(
      model,
      [
        {
          role: "system",
          content: "Tu es Backstage, l'assistant de Mattia. Résume sa journée en 3-4 phrases naturelles en français, sans listes. Sois utile et concis.",
        },
        { role: "user", content: prompt },
      ],
      []
    );

    const summary = result.content.trim() || "Aucun élément notable aujourd'hui.";

    const brief: DailyBrief = {
      date: today,
      summary,
      events: [
        ...todayConcerts.map((c) => ({
          title: `Concert : ${c.artist} @ ${c.venue}`,
          type: "concert" as const,
        })),
        ...todayReminders.map((r) => ({
          title: r.title,
          type: "reminder" as const,
        })),
      ],
      reminders: todayReminders.map((r) => ({ title: r.title, dueAt: r.dueAt })),
      emails: unreadEmails.map((e) => ({ from: e.from, subject: e.subject })),
      generatedAt: new Date().toISOString(),
      urgentEmails: urgentEmails.map((e) => ({ from: e.from, subject: e.subject })),
      leetcodeDaily: leetcodeDaily ? { title: leetcodeDaily.title, difficulty: leetcodeDaily.difficulty ?? "" } : undefined,
      weather: weather || undefined,
      concertChecklist,
    };

    const existing = await readJsonSafe<DailyBriefsData>(BRIEF_FILENAME, { briefs: [] });
    existing.briefs.unshift(brief);
    existing.briefs = existing.briefs.slice(0, 30);
    await writeJsonAtomic(BRIEF_FILENAME, existing);

    return summary;
  } catch (err) {
    console.error("[daily-brief] Erreur :", err);
    return null;
  }
}
