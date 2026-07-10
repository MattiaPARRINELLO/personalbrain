const CACHE = "backstage-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/backstage-logo-simple.png",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];
const REMINDER_CHECK_INTERVAL = 60000;
const DAILY_BRIEF_HOUR = 7;

const shownReminders = new Set();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => {
      resetDailyBriefFlag();
      startReminderPolling();
      scheduleDailyBrief();
    })
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function scheduleDailyBrief() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAILY_BRIEF_HOUR, 0, 0);
  if (now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  const msUntilTarget = target.getTime() - now.getTime();
  setTimeout(() => {
    triggerDailyBrief();
    setInterval(() => {
      const h = new Date().getHours();
      if (h === DAILY_BRIEF_HOUR) triggerDailyBrief();
    }, 3600000);
  }, msUntilTarget);
}

let dailyBriefFiredToday = false;

function resetDailyBriefFlag() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  setTimeout(() => {
    dailyBriefFiredToday = false;
    resetDailyBriefFlag();
  }, nextMidnight.getTime() - now.getTime());
}

async function triggerDailyBrief() {
  if (dailyBriefFiredToday) return;
  try {
    const res = await fetch("/api/daily-brief", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data?.brief) {
        dailyBriefFiredToday = true;
        const clientsList = await self.clients.matchAll({ type: "window" });
        for (const client of clientsList) {
          client.postMessage({ type: "daily-brief", brief: data.brief });
        }
        self.registration.showNotification("Brief du jour", {
          body: data.brief.slice(0, 120) + (data.brief.length > 120 ? "…" : ""),
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: "daily-brief",
          data: { type: "daily-brief", url: "/notif/daily-brief" },
          vibrate: [100, 50, 100],
          requireInteraction: false,
        });
      }
    }
  } catch (err) {
    console.error("[SW] Daily brief failed:", err);
  }
}

let reminderInterval = null;

function startReminderPolling() {
  if (reminderInterval) return;
  getPendingReminders();
  reminderInterval = setInterval(async () => {
    try {
      const reminders = await getPendingReminders();
      for (const r of reminders) {
        if (shownReminders.has(r.id)) continue;
        shownReminders.add(r.id);
        self.registration.showNotification(r.title, {
          body: r.description || "Rappel",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: "reminder-" + r.id,
          data: { type: "reminder", reminderId: r.id, url: r.link || "/reminders", recurrence: r.recurrence },
          requireInteraction: true,
          actions: [
            { action: "done", title: "✓ Fait" },
            { action: "snooze", title: "⏰ +15 min" },
          ],
          vibrate: [200, 100, 200],
        });
      }
    } catch (err) {
      console.error("[SW] Reminder check failed:", err);
    }
  }, REMINDER_CHECK_INTERVAL);
}

async function getPendingReminders() {
  const cache = await caches.open("reminders-v1");
  const cached = await cache.match("/api/reminders/pending");
  if (cached) {
    const data = await cached.json();
    const cachedAt = new Date(cached.headers.get("sw-cached-at") || 0);
    if (Date.now() - cachedAt.getTime() < 30000) {
      return data.reminders;
    }
  }
  try {
    const res = await fetch("/api/reminders/pending");
    if (res.ok) {
      const clone = res.clone();
      const cacheResp = new Response(clone.body, clone);
      cacheResp.headers.set("sw-cached-at", new Date().toISOString());
      cache.put("/api/reminders/pending", cacheResp);
      const data = await res.json();
      return data.reminders;
    }
  } catch {}
  return [];
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { reminderId, url, recurrence, type } = event.notification.data;

  if (type === "daily-brief") {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/notif/daily-brief") && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url || "/notif/daily-brief");
        }
      })
    );
    return;
  }

  if (event.action === "done") {
    fetch(`/api/reminders/${reminderId}/done`, { method: "POST" }).then(() => {
      if (recurrence) {
        fetch(`/api/reminders/${reminderId}/recur`, { method: "POST" });
      }
    });
  } else if (event.action === "snooze") {
    fetch(`/api/reminders/${reminderId}/snooze`, { method: "POST" });
  } else {
    const targetUrl = reminderId ? `/notif/reminder/${reminderId}` : (url || "/reminders");
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
