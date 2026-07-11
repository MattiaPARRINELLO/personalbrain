const VAPID_PUBLIC_KEY = "BMmFNNXqVHLnhyokND2qq1ga3n1lq_4w1eTEhuU0Q-3f6wZUOMgQ0jeT03CkwsobgmRnxrmDPCGpj6FmLjP7bl0";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }).then((newSub) => {
      return fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSub.toJSON()),
      });
    }).catch((err) => {
      console.error("[SW] pushsubscriptionchange error:", err);
    })
  );
});
const CACHE = "backstage-v2";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/backstage-logo-simple.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

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
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const options = {
      body: payload.body || "",
      icon: payload.icon || "/icons/icon-192.png",
      badge: payload.badge || "/icons/icon-192.png",
      tag: payload.tag,
      data: payload.data,
      requireInteraction: payload.requireInteraction ?? false,
      vibrate: payload.vibrate || [200, 100, 200],
      actions: payload.actions || [],
    };
    event.waitUntil(
      self.registration.showNotification(payload.title, options)
    );
  } catch (err) {
    console.error("[SW] push event error:", err);
  }
});

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

  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("/"))
      )
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return res;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
