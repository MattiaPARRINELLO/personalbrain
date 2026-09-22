import { getReminders, getCourses, getCoursesStartingSoon, courseNotifKey } from "./storage";
import { getSubscriptions, type StoredPushSubscription } from "./push-subscriptions";
import { getConfig } from "./config";
import { configureVapid, getVapidDetails, sendPushNotification } from "./send-push";
import { serverLog } from "./logger";
import { markdownToText } from "./utils";

let schedulerStarted = false;
let reminderInterval: ReturnType<typeof setInterval> | null = null;
let dailyBriefTimeout: ReturnType<typeof setTimeout> | null = null;
let dailyBriefInterval: ReturnType<typeof setInterval> | null = null;

const REMINDER_INTERVAL_MS = 60_000;
const DAILY_BRIEF_HOUR = 7;
const NOTIFIED_FILE = "notified-reminders.json";
const NOTIFIED_COURSES_FILE = "notified-courses.json";

// Focus mode actif : les notifications sont mises en silence. Les rappels et
// relances restent en attente et seront envoyés après la fin de la session.
async function isFocusActive(): Promise<boolean> {
  try {
    const { getFocusState } = await import("./focus");
    const state = await getFocusState();
    if (!state.active || !state.endsAt) return false;
    return new Date(state.endsAt).getTime() > Date.now();
  } catch {
    return false;
  }
}

async function getNotifiedReminders(): Promise<Set<string>> {
  try {
    const { readJsonSafe } = await import("./storage");
    const data = await readJsonSafe<{ ids: string[] }>(NOTIFIED_FILE, { ids: [] });
    return new Set(data.ids);
  } catch {
    return new Set();
  }
}

async function markReminderNotified(id: string): Promise<void> {
  try {
    const { mutateJson } = await import("./storage-core");
    await mutateJson<{ ids: string[] }>(NOTIFIED_FILE, { ids: [] }, (data) => {
      if (data.ids.includes(id)) return null; // déjà notifié → pas d'écriture
      data.ids.push(id);
    });
  } catch (err) {
    void serverLog("scheduler", "error", "Erreur persistance notification", err);
  }
}

const COURSE_LEAD_MIN = 30;

/** Notifications "Cours dans 30 min" : matière + salle, déduites de l'EDT CESAR. */
export async function checkScheduleNotifs(): Promise<void> {
  try {
    if (await isFocusActive()) return;
    const courses = await getCourses();
    if (!courses.length) return;

    const now = Date.now();
    const dueCourses = getCoursesStartingSoon(courses, COURSE_LEAD_MIN, now);

    if (!dueCourses.length) return;
    const { readJsonSafe, writeJsonAtomic } = await import("./storage");
    const notified = new Set(
      (await readJsonSafe<{ keys: string[] }>(NOTIFIED_COURSES_FILE, { keys: [] })).keys
    );

    let dirty = false;
    for (const c of dueCourses) {
      const key = courseNotifKey(c, COURSE_LEAD_MIN);
      if (notified.has(key)) continue;

      const at = new Date(c.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const payload = JSON.stringify({
        title: `Cours dans ${COURSE_LEAD_MIN} min : ${c.subject}`,
        body: [at, c.room, c.teacher].filter(Boolean).join(" — ") || "Séance",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `course-${key}`,
        data: { type: "course", url: "/schedule" },
        requireInteraction: false,
        vibrate: [200, 100, 200],
      });
      const { sent } = await sendPushToAll(payload, `course-${key}`);
      if (sent) {
        notified.add(key);
        dirty = true;
        const { logActivity } = await import("./storage");
        await logActivity("course_notified", `Cours à venir : ${c.subject}`, `${at} — ${c.room}`);
      }
    }
    if (dirty) {
      // purge les clés de séances passées (> 1 h après la fin)
      const allKeys = new Set(
        courses.filter((c) => c.end > now - 3 * 3_600_000).map((c) => courseNotifKey(c, COURSE_LEAD_MIN))
      );
      await writeJsonAtomic("notified-courses.json", { keys: [...notified].filter((k) => allKeys.has(k)) });
    }
  } catch (err) {
    void serverLog("scheduler", "error", "checkScheduleNotifs failed", err);
  }
}

/** Sync EDT CESAR si périmé (> 6 h, 0 séance, ou dernier sync en échec). Non bloquant. */
export async function syncScheduleIfStale(): Promise<void> {
  try {
    const { isScheduleStale, syncSchedule } = await import("./storage");
    if (await isScheduleStale()) {
      await syncSchedule();
    }
  } catch (err) {
    void serverLog("scheduler", "error", "syncScheduleIfStale failed", err);
  }
}

export async function sendPushToAll(
  payload: string,
  _tag?: string
): Promise<{ sent: boolean; devices: number }> {
  const subs = await getSubscriptions();
  let webSent = false;
  if (subs.length > 0) {
    const vapidDetails = configureVapid();
    if (!vapidDetails.publicKey || !vapidDetails.privateKey) {
      void serverLog("scheduler", "error", "VAPID keys missing");
    } else {
      console.log(`[scheduler] Envoi push à ${subs.length} appareil(s)...`);

      const results = await Promise.allSettled(
        subs.map(async (sub: StoredPushSubscription) => {
          try {
            await sendPushNotification(sub.endpoint, sub.keys, payload);
            console.log(`[scheduler] Push OK → ${sub.endpoint.slice(0, 50)}...`);
            return true;
          } catch (err: unknown) {
            const e = err as { statusCode?: number; body?: string };
            void serverLog("scheduler", "error", `Push ÉCHEC ${e.statusCode || ""} → ${sub.endpoint.slice(0, 50)}...`, undefined, true);
            if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 401) {
              const { removeSubscription } = await import("./push-subscriptions");
              await removeSubscription(sub.endpoint);
              console.log(`[scheduler] Souscription invalide supprimée: ${sub.endpoint.slice(0, 50)}...`);
            }
            return false;
          }
        })
      );

      webSent = results.some((r) => r.status === "fulfilled" && r.value === true);

      const failed = results.filter((r) => r.status === "fulfilled" && r.value === false).length;
      if (failed > 0) {
        console.warn(`[scheduler] ${failed}/${subs.length} push notifications failed`);
      } else {
        console.log(`[scheduler] ${subs.length}/${subs.length} push envoyés avec succès`);
      }
    }
  }

  return { sent: webSent, devices: subs.length };
}

export async function checkReminders() {
  try {
    if (await isFocusActive()) return; // silence pendant le focus
    const data = await getReminders();
    const now = Date.now();
    const pending = data.reminders.filter(
      (r) => r.status === "pending" && new Date(r.dueAt).getTime() <= now + 60_000
    );

    const notifiedReminders = await getNotifiedReminders();

    // Purge les IDs de rappels qui n'existent plus (supprimés ou terminés)
    const allReminderIds = new Set(data.reminders.map((r) => r.id));
    const purged = [...notifiedReminders].filter((id) => !allReminderIds.has(id));
    if (purged.length > 0) {
      for (const id of purged) notifiedReminders.delete(id);
      const { writeJsonAtomic } = await import("./storage");
      await writeJsonAtomic(NOTIFIED_FILE, { ids: [...notifiedReminders] });
    }

    for (const r of pending) {
      if (notifiedReminders.has(r.id)) continue;

      const payload = JSON.stringify({
        title: r.title,
        body: r.notes || "Rappel",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "reminder-" + r.id,
        data: { type: "reminder", reminderId: r.id, url: "/reminders", recurrence: r.recurrence },
        requireInteraction: true,
        actions: [
          { action: "done", title: "✓ Fait" },
          { action: "snooze", title: "⏰ +15 min" },
        ],
        vibrate: [200, 100, 200],
      });

      // On marque le rappel notifié SEULEMENT si l'envoi a réussi (web) :
      // sinon il sera retenté au prochain tick au lieu d'être perdu.
      const { sent } = await sendPushToAll(payload, "reminder-" + r.id);
      if (sent) {
        notifiedReminders.add(r.id);
        await markReminderNotified(r.id);
      }
    }
  } catch (err) {
    void serverLog("scheduler", "error", "checkReminders failed", err);
  }
}

export async function checkIntentions() {
  try {
    if (await isFocusActive()) return; // silence pendant le focus
    const { listPendingIntentions, resolveIntention } = await import("./storage");
    const now = Date.now();
    const due = (await listPendingIntentions()).filter(
      (i) => new Date(i.dueAt).getTime() <= now + 60_000
    );

    for (const it of due) {
      const payload = JSON.stringify({
        title: `Relance : ${it.subject}`,
        body: it.message || `Tu voulais relancer sur « ${it.subject} ».`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "intention-" + it.id,
        data: { type: "intention", intentionId: it.id, url: "/chat" },
        requireInteraction: false,
        vibrate: [200, 100, 200],
      });

      // Marquée faite UNIQUEMENT si l'envoi a réussi, sinon retentée au tick suivant.
      const { sent } = await sendPushToAll(payload, "intention-" + it.id);
      if (sent) {
        await resolveIntention(it.id, "done");
      }
    }
  } catch (err) {
    void serverLog("scheduler", "error", "checkIntentions failed", err);
  }
}

export async function triggerDailyBrief(
  source: "cron" | "page-test" | "interne" = "interne",
  ip?: string
): Promise<
  { sent: boolean; devices: number } | { skipped: string }
> {
  try {
    const config = await getConfig();
    if (!config.features.dailyBrief) return { skipped: "dailyBrief desactive" };

    const { readJsonSafe } = await import("./storage");
    const data = await readJsonSafe<{ briefs: { date: string; summary: string }[] }>("daily-briefs.json", { briefs: [] });
    const today = new Date().toISOString().slice(0, 10);
    let todayBrief = data.briefs.find((b) => b.date === today);

    if (!todayBrief) {
      console.log("[scheduler] Pas de brief pour aujourd'hui, génération automatique...");
      const { generateDailyBrief } = await import("./daily-brief");
      const summary = await generateDailyBrief();
      if (!summary) {
        console.log("[scheduler] Échec génération brief");
        return { skipped: "generation impossible" };
      }
      const updated = await readJsonSafe<{ briefs: { date: string; summary: string }[] }>("daily-briefs.json", { briefs: [] });
      todayBrief = updated.briefs.find((b) => b.date === today);
      if (!todayBrief) {
        console.log("[scheduler] Brief généré mais introuvable après sauvegarde");
        return { skipped: "brief introuvable apres sauvegarde" };
      }
    }

    const briefBody = markdownToText(todayBrief.summary);
    const payload = JSON.stringify({
      title: "Brief du jour",
      body: briefBody.slice(0, 180) + (briefBody.length > 180 ? "…" : ""),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "daily-brief",
      data: { type: "daily-brief", url: "/notif/daily-brief" },
      requireInteraction: false,
      vibrate: [100, 50, 100],
    });

    const result = await sendPushToAll(payload, "daily-brief");
    const { logActivity } = await import("./storage");
    await logActivity(
      "daily_brief_sent",
      result.sent ? "Brief du jour envoyé" : "Brief du jour : envoi échoué",
      `${result.devices} appareil(s) ciblé(s) [${source}]${ip ? ` depuis ${ip}` : ""}`
    );
    return result;
  } catch (err) {
    void serverLog("scheduler", "error", "triggerDailyBrief failed", err);
    return { skipped: "erreur interne" };
  }
}

function startDailyBrief() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAILY_BRIEF_HOUR, 0, 0);
  if (now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const msUntilTarget = target.getTime() - now.getTime();
  dailyBriefTimeout = setTimeout(() => {
    triggerDailyBrief();
    dailyBriefInterval = setInterval(() => {
      const h = new Date().getHours();
      if (h === DAILY_BRIEF_HOUR) triggerDailyBrief();
    }, 3_600_000);
  }, msUntilTarget);
}

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const vapidDetails = getVapidDetails();
  if (!vapidDetails.publicKey || !vapidDetails.privateKey) {
    console.warn("[scheduler] VAPID keys not configured, notifications disabled");
    return;
  }

  checkReminders();
  checkIntentions();
  checkScheduleNotifs();
  syncScheduleIfStale();
  reminderInterval = setInterval(() => {
    checkReminders();
    checkIntentions();
    checkScheduleNotifs();
    syncScheduleIfStale();
  }, REMINDER_INTERVAL_MS);

  startDailyBrief();

  console.log("[scheduler] Started — reminders every 60s, daily brief at", DAILY_BRIEF_HOUR + "h");
}

export function stopScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  if (dailyBriefTimeout) {
    clearTimeout(dailyBriefTimeout);
    dailyBriefTimeout = null;
  }
  if (dailyBriefInterval) {
    clearInterval(dailyBriefInterval);
    dailyBriefInterval = null;
  }
  schedulerStarted = false;
  console.log("[scheduler] Stopped");
}
