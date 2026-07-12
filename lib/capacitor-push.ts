import { isCapacitor } from "./capacitor";

interface PushRegistration {
  token: string;
  platform: string;
  createdAt: string;
}

export async function registerCapacitorPush(): Promise<void> {
  if (!isCapacitor()) return;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  const permResult = await PushNotifications.requestPermissions();
  if (permResult.receive !== "granted") {
    console.log("[capacitor-push] Permission refusée");
    return;
  }

  let tokenReceived = false;

  PushNotifications.addListener("registration", (token) => {
    tokenReceived = true;
    console.log("[capacitor-push] Token FCM reçu:", token.value.slice(0, 20) + "...");
    const body: PushRegistration = {
      token: token.value,
      platform: "android",
      createdAt: new Date().toISOString(),
    };
    registerTokenWithRetry(body);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[capacitor-push] Erreur enregistrement FCM:", err);
  });

  PushNotifications.addListener("pushNotificationReceived", async (notification) => {
    console.log("[capacitor-push] Notification reçue:", notification);
    const title = (notification as unknown as { title?: string }).title || "BACKSTAGE";
    const body = (notification as unknown as { body?: string }).body || "";
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Date.now(),
          smallIcon: "ic_stat_notification",
          channelId: "default",
        },
      ],
    });
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    console.log("[capacitor-push] Action effectuée:", action);
  });

  await PushNotifications.register();

  setTimeout(() => {
    if (!tokenReceived) {
      console.warn("[capacitor-push] Aucun token FCM reçu après 10s — l'appareil n'est pas enregistré pour les push");
    }
  }, 10_000);
}

async function registerTokenWithRetry(body: PushRegistration, attempt = 0) {
  const maxAttempts = 5;
  const baseDelay = 2000;

  try {
    const res = await fetch("/api/push/register-capacitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      console.log("[capacitor-push] Token enregistré côté serveur");
    } else {
      console.error("[capacitor-push] Échec enregistrement token:", res.status, await res.text());
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.error("[capacitor-push] Erreur réseau enregistrement token:", err);
    if (attempt < maxAttempts) {
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[capacitor-push] Nouvelle tentative dans ${delay}ms (${attempt + 1}/${maxAttempts})`);
      setTimeout(() => registerTokenWithRetry(body, attempt + 1), delay);
    }
  }
}

export async function unregisterCapacitorPush(): Promise<void> {
  if (!isCapacitor()) return;

  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.unregister();
  console.log("[capacitor-push] Désenregistré");
}
