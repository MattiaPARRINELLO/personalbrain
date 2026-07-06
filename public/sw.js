const CACHE = "backstage-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];
const REMINDER_CHECK_INTERVAL = 60000;
const DAILY_BRIEF_HOUR = 7;

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
      startReminderPolling();
      scheduleDailyBrief();
    })
  );
  self.clients.claim();
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

async function triggerDailyBrief() {
  try {
    const res = await fetch("/api/daily-brief", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data?.brief) {
        const clientsList = await self.clients.matchAll({ type: "window" });
        for (const client of clientsList) {
          client.postMessage({ type: "daily-brief", brief: data.brief });
        }
      }
    }
  } catch (err) {
    console.error("[SW] Daily brief failed:", err);
  }
}

async function startReminderPolling() {
  setInterval(async () => {
    try {
      const reminders = await getPendingReminders();
      for (const r of reminders) {
        if (new Date(r.dueAt).getTime() <= Date.now()) {
          self.registration.showNotification(r.title, {
            body: r.notes || "C'est l'heure !",
            icon: "/icons/icon-192.svg",
            badge: "/icons/icon-192.svg",
            tag: `reminder-${r.id}`,
            data: { reminderId: r.id, url: "/reminders", recurrence: r.recurrence },
            requireInteraction: true,
            actions: [
              { action: "done", title: "✓ Fait" },
              { action: "snooze", title: "⏰ +15 min" },
            ],
            vibrate: [200, 100, 200],
          });
        }
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
  const { reminderId, url, recurrence } = event.notification.data;

  if (event.action === "done") {
    fetch(`/api/reminders/${reminderId}/done`, { method: "POST" }).then(() => {
      if (recurrence) {
        fetch(`/api/reminders/${reminderId}/recur`, { method: "POST" });
      }
    });
  } else if (event.action === "snooze") {
    fetch(`/api/reminders/${reminderId}/snooze`, { method: "POST" });
  } else {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url || "/reminders") && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url || "/reminders");
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
        .catch(() => caches.match(event.request))
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
