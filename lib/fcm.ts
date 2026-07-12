import { readJsonSafe } from "./storage";

const _import = new Function("url", "return import(url)") as (url: string) => Promise<unknown>;

const BASE = "file://" + process.cwd() + "/node_modules/firebase-admin/lib/";
const FB_ADMIN = BASE + "index.js";
const FB_MSG = BASE + "messaging/index.js";

interface FirebaseAdmin {
  initializeApp: (opts: { credential: object }) => void;
  cert: (sa: { projectId: string; privateKey: string; clientEmail: string }) => object;
  getApps: () => { length: number }[];
}

interface FirebaseMessaging {
  getMessaging: () => {
    sendEachForMulticast: (msg: {
      notification: { title: string; body: string };
      tokens: string[];
    }) => Promise<{
      successCount: number;
      failureCount: number;
      responses: { success: boolean; error?: { message?: string } }[];
    }>;
  };
}

let _fb: { admin: FirebaseAdmin; messaging: FirebaseMessaging } | null = null;

async function loadFirebase() {
  if (_fb) return _fb;
  const [admin, messaging] = await Promise.all([
    _import(FB_ADMIN),
    _import(FB_MSG),
  ]);
  _fb = { admin: admin as FirebaseAdmin, messaging: messaging as FirebaseMessaging };
  return _fb;
}

interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
  [key: string]: unknown;
}

interface CapacitorToken {
  token: string;
  platform: string;
  createdAt: string;
}

interface PushSubscriptionsCapacitorData {
  tokens: CapacitorToken[];
}

export async function initFirebase(): Promise<void> {
  const { admin } = await loadFirebase();
  if (admin.getApps().length > 0) return;

  try {
    const serviceAccount = await readJsonSafe<ServiceAccount>("firebase-service-account.json", {} as ServiceAccount);
    admin.initializeApp({
      credential: admin.cert({
        projectId: serviceAccount.project_id,
        privateKey: serviceAccount.private_key,
        clientEmail: serviceAccount.client_email,
      }),
    });
    console.log("[fcm] Firebase initialisé");
  } catch (err) {
    console.error("[fcm] Erreur initialisation Firebase:", err);
  }
}

export async function sendFcmPushToAll(payload: string): Promise<void> {
  const { messaging } = await loadFirebase();
  await initFirebase();

  const data = await readJsonSafe<PushSubscriptionsCapacitorData>(
    "push-subscriptions-capacitor.json",
    { tokens: [] }
  );

  const tokens = data.tokens.map((t) => t.token);
  if (tokens.length === 0) {
    console.log("[fcm] Aucun token FCM enregistré");
    return;
  }

  let parsed: { title?: string; body?: string };
  try {
    parsed = JSON.parse(payload);
  } catch {
    parsed = { title: "BACKSTAGE", body: payload };
  }

  const message = {
    notification: {
      title: parsed.title || "BACKSTAGE",
      body: parsed.body || "",
    },
    android: {
      notification: {
        channel_id: "default",
        priority: "high",
        notification_count: 1,
        icon: "ic_stat_notification",
        color: "#ff9900",
      },
    },
    tokens,
  };

  try {
    const response = await messaging.getMessaging().sendEachForMulticast(message);
    const success = response.successCount;
    const failure = response.failureCount;
    console.log(`[fcm] Envoyé: ${success} succès, ${failure} échecs`);
    if (failure > 0) {
      response.responses.forEach((resp: { success: boolean; error?: { message?: string } }, idx: number) => {
        if (!resp.success) {
          console.error(`[fcm] Échec token ${idx}:`, resp.error?.message);
        }
      });
    }
  } catch (err) {
    console.error("[fcm] Erreur envoi multicast:", err);
  }
}
