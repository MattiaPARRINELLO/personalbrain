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

export async function sendPushToAll(payload: string, tag?: string) {
  const subs = await getSubscriptions();
  if (subs.length === 0) return;

  const vapidDetails = configureVapid();
  if (!vapidDetails.publicKey || !vapidDetails.privateKey) {
    console.error("[scheduler] VAPID keys missing");
    return;
  }

  console.log(`[scheduler] Envoi push à ${subs.length} appareil(s)...`);

  const results = await Promise.allSettled(
    subs.map(async (sub: StoredPushSubscription) => {
      try {
        await sendPushNotification(sub.endpoint, sub.keys, payload);
        console.log(`[scheduler] Push OK → ${sub.endpoint.slice(0, 50)}...`);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; body?: string };
        console.error(`[scheduler] Push ÉCHEC ${e.statusCode || ""} → ${sub.endpoint.slice(0, 50)}...`, e.body || "");
        if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 401) {
          const { removeSubscription } = await import("./push-subscriptions");
          await removeSubscription(sub.endpoint);
          console.log(`[scheduler] Souscription invalide supprimée: ${sub.endpoint.slice(0, 50)}...`);
        }
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.warn(`[scheduler] ${failed}/${subs.length} push notifications failed`);
  } else {
    console.log(`[scheduler] ${subs.length}/${subs.length} push envoyés avec succès`);
  }

  try {
    const { sendFcmPushToAll } = await import("./fcm");
    await sendFcmPushToAll(payload);
  } catch (err) {
    console.error("[scheduler] Erreur FCM:", err);
  }
}

export async function checkReminders() {
  try {
    const data = await getReminders();
    const now = Date.now();
    const pending = data.reminders.filter(
      (r) => r.status === "pending" && new Date(r.dueAt).getTime() <= now + 60_000
    );

    const notifiedReminders = await getNotifiedReminders();

    for (const r of pending) {
      if (notifiedReminders.has(r.id)) continue;
      notifiedReminders.add(r.id);
      await markReminderNotified(r.id);

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

      await sendPushToAll(payload, "reminder-" + r.id);
    }
  } catch (err) {
    console.error("[scheduler] checkReminders failed:", err);
  }
}

export async function triggerDailyBrief() {
  try {
    const config = await getConfig();
    if (!config.features.dailyBrief) return;

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
        return;
      }
      const updated = await readJsonSafe<{ briefs: { date: string; summary: string }[] }>("daily-briefs.json", { briefs: [] });
      todayBrief = updated.briefs.find((b) => b.date === today);
      if (!todayBrief) {
        console.log("[scheduler] Brief généré mais introuvable après sauvegarde");
        return;
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

    await sendPushToAll(payload, "daily-brief");
  } catch (err) {
    console.error("[scheduler] triggerDailyBrief failed:", err);
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
  reminderInterval = setInterval(checkReminders, REMINDER_INTERVAL_MS);

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
