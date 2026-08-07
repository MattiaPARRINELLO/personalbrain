import { NextResponse } from "next/server";
import { addSubscription, removeSubscription, getSubscriptions } from "@/lib/push-subscriptions";
import type { StoredPushSubscription } from "@/lib/push-subscriptions";
import { configureVapid, sendPushNotification } from "@/lib/send-push";
import { getSession } from "@/lib/session";

// Le POST d'abonnement reste public (appelé par le service worker en
// arrière-plan), mais la liste, le test et la suppression exigent une session.
async function requireSessionOr401(): Promise<NextResponse | null> {
  const session = await getSession();
  return session ? null : NextResponse.json({ error: "Non authentifié" }, { status: 401 });
}

export async function GET() {
  const denied = await requireSessionOr401();
  if (denied) return denied;
  const subs = await getSubscriptions();
  return NextResponse.json({ count: subs.length, endpoints: subs.map((s) => s.endpoint.slice(0, 60) + "...") });
}

export async function POST(request: Request) {
  try {
    const sub = (await request.json()) as StoredPushSubscription;
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return NextResponse.json({ error: "Subscription invalide" }, { status: 400 });
    }
    await addSubscription(sub);
    console.log("[push subscribe] Nouvelle souscription:", sub.endpoint.slice(0, 60) + "...");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push subscribe]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await requireSessionOr401();
  if (denied) return denied;
  try {
    configureVapid();

    const body = (await request.json().catch(() => ({}))) as { title?: string; message?: string };
    const title = body.title || "Test BACKSTAGE";
    const message = body.message || "Ceci est une notification de test";

    const subs = await getSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, count: 0, endpoints: [] });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "test-notif",
      data: { type: "test", url: "/reminders" },
      requireInteraction: false,
      vibrate: [200, 100, 200],
    });

    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await sendPushNotification(sub.endpoint, sub.keys, payload);
          return { endpoint: sub.endpoint.slice(0, 60) + "...", ok: true };
        } catch (err) {
          const e = err as { statusCode?: number; body?: string; message?: string };
          return { endpoint: sub.endpoint.slice(0, 60) + "...", ok: false, error: e.message || e.body || String(e), statusCode: e.statusCode };
        }
      })
    );

    const succeeded: string[] = [];
    const errors: { endpoint: string; error: string; statusCode?: number }[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value.ok) {
          succeeded.push(r.value.endpoint);
        } else {
          errors.push({ endpoint: r.value.endpoint, error: r.value.error || "Erreur inconnue", statusCode: r.value.statusCode });
        }
      } else {
        errors.push({ endpoint: "unknown", error: "rejected" });
      }
    }

    return NextResponse.json({ sent: succeeded.length, failed: errors.length, count: subs.length, endpoints: succeeded, errors });
  } catch (err) {
    console.error("[push test]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  const denied = await requireSessionOr401();
  if (denied) return denied;
  try {
    const { endpoint, all } = (await request.json()) as { endpoint?: string; all?: boolean };
    if (all) {
      const subs = await getSubscriptions();
      for (const sub of subs) {
        await removeSubscription(sub.endpoint);
      }
      return NextResponse.json({ ok: true, cleared: subs.length + " web push" });
    }
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint requis" }, { status: 400 });
    }
    await removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push unsubscribe]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
