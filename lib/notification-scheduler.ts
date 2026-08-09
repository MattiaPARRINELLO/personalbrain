import { getReminders } from "./storage";
import { getSubscriptions, type StoredPushSubscription } from "./push-subscriptions";
import { getConfig } from "./config";
import { configureVapid, getVapidDetails, sendPushNotification } from "./send-push";

let schedulerStarted = false;
let reminderInterval: ReturnType<typeof setInterval> | null = null;
let dailyBriefTimeout: ReturnType<typeof setTimeout> | null = null;
let dailyBriefInterval: ReturnType<typeof setInterval> | null = null;

const REMINDER_INTERVAL_MS = 60_000;
const DAILY_BRIEF_HOUR = 7;
const NOTIFIED_FILE = "notified-reminders.json";

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
    const { readJsonSafe, writeJsonAtomic } = await import("./storage");
    const data = await readJsonSafe<{ ids: string[] }>(NOTIFIED_FILE, { ids: [] });
    if (!data.ids.includes(id)) {
      data.ids.push(id);
      await writeJsonAtomic(NOTIFIED_FILE, data);
    }
  } catch (err) {
    console.error("[scheduler] Erreur persistance notification:", err);
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
      console.error("[scheduler] VAPID keys missing");
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
            console.error(`[scheduler] Push ÉCHEC ${e.statusCode || ""} → ${sub.endpoint.slice(0, 50)}...`, e.body || "");
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
    console.error("[scheduler] checkReminders failed:", err);
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
    console.error("[scheduler] checkIntentions failed:", err);
  }
}

export async function triggerDailyBrief(): Promise<
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

    const payload = JSON.stringify({
      title: "Brief du jour",
      body: todayBrief.summary.slice(0, 120) + (todayBrief.summary.length > 120 ? "…" : ""),
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
      `${result.devices} appareil(s) ciblé(s)`
    );
    return result;
  } catch (err) {
    console.error("[scheduler] triggerDailyBrief failed:", err);
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
  reminderInterval = setInterval(() => {
    checkReminders();
    checkIntentions();
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
