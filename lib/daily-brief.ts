import { getReminders, getConcerts, getLeetcode, getCalendar, getCourses, getCoursesForDay, writeJsonAtomic, readJsonSafe, prepareConcert, formatCourse } from "./storage";
import { fetchGoogleCalendarEvents, fetchGmailMessages } from "./google-actions";
import { chatCompletion } from "./ai-providers";
import { getConfig } from "./config";
import { toISODate, toHHMM } from "./utils";
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

    const [remindersData, concertsData, unreadEmails, leetcodeData, calendarEvents] = await Promise.all([
      getReminders(),
      getConcerts(),
      fetchGmailMessages("is:unread", 20).catch(() => []),
      getLeetcode(),
      getCalendar().catch(() => []),
    ]);
    const courses = await getCourses();
    const todayCourses = getCoursesForDay(courses, today);

    // Rappels du jour encore pending
    const todayReminders = remindersData.reminders.filter(
      (r) => toISODate(r.dueAt) === today && r.status === "pending"
    );

    // Concerts du jour
    const todayConcerts = concertsData.events.filter((c) => c.date === today);

    // Agenda du jour : calendrier local + événements Google (récupérés à la volée)
    const dayStart = new Date(`${today}T00:00:00`).toISOString();
    const dayEnd = new Date(`${today}T23:59:59`).toISOString();
    const googleEvents = await fetchGoogleCalendarEvents(dayStart, dayEnd).catch(() => []);
    const todayAgenda = [
      ...calendarEvents
        .filter((e) => toISODate(e.date) === today)
        .map((e) => ({ title: e.title, time: toHHMM(e.date) })),
      ...googleEvents
        .filter((e) => toISODate(e.start) === today)
        .map((e) => ({ title: e.summary, time: toHHMM(e.start) })),
    ];

    // Emails non lus + urgents
    const urgentEmails = unreadEmails.filter(
      (e) => /urgent|rappel|relance|deadline|échéance/i.test(e.subject)
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
    let prompt = "Voici les données de la journée :\n";

    if (todayAgenda.length > 0) {
      prompt +=
        "\nAgenda :\n" +
        todayAgenda.map((e) => `- ${e.title}${e.time ? ` (${e.time})` : ""}`).join("\n") +
        "\n";
    }
    if (todayCourses.length > 0) {
      prompt += "\nCours du jour (emploi du temps CESAR) :\n" + todayCourses.map(formatCourse).join("\n") + "\n";
    }
    if (todayConcerts.length > 0) {
      prompt += "\nConcerts aujourd'hui :\n" + todayConcerts.map((c) => `- ${c.artist} @ ${c.venue}`).join("\n") + "\n";
    }
    if (todayReminders.length > 0) {
      prompt += "\nRappels du jour :\n" + todayReminders.map((r) => `- ${r.title} (${toHHMM(r.dueAt)})`).join("\n") + "\n";
    }
    if (urgentEmails.length > 0) {
      prompt += "\nEmails urgents :\n" + urgentEmails.map((e) => `- ${e.from} : ${e.subject}`).join("\n") + "\n";
    }
    const otherUnread = unreadEmails.filter((e) => !urgentEmails.includes(e)).slice(0, 8);
    if (otherUnread.length > 0) {
      prompt +=
        `\nEmails non lus (${unreadEmails.length} au total) :\n` +
        otherUnread.map((e) => `- ${e.from} : ${e.subject}`).join("\n") +
        "\n";
    }
    if (leetcodeDaily) {
      prompt += `\nDernier exercice LeetCode : ${leetcodeDaily.title} (${leetcodeDaily.difficulty})\n`;
    }
    if (weather) {
      prompt += `\nMétéo du jour à Paris : ${weather}\n`;
    }

    if (todayConcerts.length === 0 && todayReminders.length === 0 && urgentEmails.length === 0 && todayCourses.length === 0) {
      prompt += "\nRien de particulier de prévu aujourd'hui.\n";
    }

    const model = config.models.general;
    const result = await chatCompletion(
      model,
      [
        {
          role: "system",
          content:
            "Tu es Backstage, l'assistant personnel de Mattia. Rédige le résumé de sa journée en un seul paragraphe fluide en français, sans listes ni titres, en t'adressant directement à lui à la deuxième personne du singulier (« tu »). N'utilise jamais son prénom ni la troisième personne. Objectif : le maximum d'informations utiles dans 6 à 10 phrases — cite systématiquement les heures, les salles et les lieux, nomme les concerts, les rappels (avec leur heure), la météo et les emails qui méritent son attention. N'omets aucun élément fourni, mais reste factuel : n'invente rien et ne mentionne pas les rubriques qui n'ont aucune donnée. Si des cours sont prévus, commence par l'heure et la salle du prochain cours. Si la journée est vide, dis-le en une phrase sans t'étendre.",
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
        ...todayCourses.map((c) => ({
          title: c.subject,
          type: "course" as const,
          time: new Date(c.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          location: c.room || undefined,
        })),
        ...todayAgenda.map((e) => ({
          title: `${e.title}${e.time ? ` — ${e.time}` : ""}`,
          type: "event" as const,
          time: e.time || undefined,
        })),
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

// Lecture seule du brief du jour — ne déclenche jamais de génération.
export async function getTodayBrief(): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await readJsonSafe<DailyBriefsData>(BRIEF_FILENAME, { briefs: [] });
  const brief = data.briefs.find((b) => b.date === today);
  return brief?.summary ?? null;
}
