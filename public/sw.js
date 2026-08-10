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

// La clé publique VAPID est servie par l'API (plus de hardcode) : la rotation
// de clé n'exige plus de rebuild ni de reinstall du service worker.
async function getVapidPublicKey() {
  const res = await fetch("/api/push/vapid-key");
  if (!res.ok) throw new Error("vapid-key HTTP " + res.status);
  const data = await res.json();
  if (!data.key) throw new Error("clé VAPID absente");
  return data.key;
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    getVapidPublicKey()
      .then((key) =>
        self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        })
      )
      .then((newSub) => {
        return fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSub.toJSON()),
        });
      })
      .catch((err) => {
        console.error("[SW] pushsubscriptionchange error:", err);
      })
  );
});
const CACHE = "backstage-v5";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/offline",
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
  if (event.data?.type === "CLEAR_CACHE") {
    // Déconnexion : purge le cache (réponses GET, pages pré-rendues contenant
    // des données personnelles) pour qu'il ne reste pas accessible.
    event.waitUntil(caches.delete(CACHE));
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

  // Network-first : le reseau prime toujours, le cache n'est qu'un fallback
  // offline. Le cache-first sur les navigations servait un vieux HTML dont
  // les chunks /_next/static/<buildId> n'existaient plus apres recompilation
  // -> le client Next rechargeait la page en boucle.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached || caches.match("/offline"))
          .then((fallback) => fallback || Response.error())
      )
  );
});
