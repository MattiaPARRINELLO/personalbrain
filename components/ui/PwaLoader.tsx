"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array;
}

async function subscribeToPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("[push] PushManager non supporté sur ce navigateur");
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration || !registration.pushManager) {
    console.log("[push] pushManager indisponible");
    return;
  }

  if (Notification.permission !== "granted") {
    console.log("[push] Demande de permission notification...");
    const result = await Notification.requestPermission();
    if (result !== "granted") {
      console.log("[push] Permission refusée:", result);
      return;
    }
    console.log("[push] Permission accordée");
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.log("[push] VAPID_PUBLIC_KEY manquante");
    return;
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    console.log("[push] Ancienne souscription détectée, révocation...");
    try {
      await existing.unsubscribe();
      console.log("[push] Ancienne souscription révoquée");
    } catch (err) {
      console.error("[push] Échec révocation:", err);
    }
  }

  try {
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any,
    });
    console.log("[push] Nouvelle souscription créée:", sub.endpoint.slice(0, 60) + "...");
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (res.ok) {
      console.log("[push] Souscription envoyée au serveur OK");
    } else {
      console.error("[push] Erreur serveur:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[push] Échec souscription:", err);
  }
}

export function PwaLoader() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateWaiting, setUpdateWaiting] = useState<ServiceWorker | null>(null);
  const [installed, setInstalled] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches
  );
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("pwa-install-dismissed") === "true"
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // La landing page est publique : ne demander la permission de notification
      // qu'aux utilisateurs connectés, jamais aux simples visiteurs.
      fetch("/api/auth/session")
        .then((r) => (r.ok ? r.json() : { authenticated: false }))
        .then((data: { authenticated: boolean }) => {
          if (data.authenticated) subscribeToPush();
        })
        .catch(() => {});
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (sw) {
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateWaiting(reg.waiting);
            }
          });
        }
      });
    });
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const mm = window.matchMedia("(display-mode: standalone)");
    function handler(e: MediaQueryListEvent) { if (e.matches) setInstalled(true); }
    mm.addEventListener("change", handler);
    return () => mm.removeEventListener("change", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setInstalled(true);
    }
  }, [installPrompt]);

  const handleUpdate = useCallback(() => {
    if (!updateWaiting) return;
    updateWaiting.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }, [updateWaiting]);

  return (
    <>
      {installPrompt && !installed && !dismissed && (
        <div className="fixed z-[90] inset-x-0 sm:inset-x-auto bottom-[calc(env(safe-area-inset-bottom)+4rem)] sm:bottom-20 sm:left-1/2 sm:-translate-x-1/2 px-3 sm:px-0">
          <div className="w-full sm:w-auto flex items-center gap-3 px-4 py-3 rounded-2xl sm:rounded-xl border border-[var(--accent)]/30 bg-[var(--surface-2)]/95 backdrop-blur text-[11px] font-mono text-[var(--accent)] animate-slide-up">
            <Image src="/backstage-logo-simple.png" alt="" width={20} height={20} className="w-5 h-5 object-contain shrink-0" />
            <span className="flex-1 min-w-0 truncate">Installer BACKSTAGE</span>
            <button
              onClick={handleInstall}
              className="shrink-0 px-4 py-2 rounded-lg bg-[var(--accent)]/20 hover:bg-[var(--accent)]/30 transition-colors"
            >
              Installer
            </button>
            <button
              onClick={() => {
                localStorage.setItem("pwa-install-dismissed", "true");
                setDismissed(true);
              }}
              aria-label="Fermer"
              className="shrink-0 w-9 h-9 -mr-1.5 flex items-center justify-center rounded-lg opacity-50 hover:opacity-100 hover:bg-[var(--surface-3)] transition-opacity"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {updateWaiting && (
        <div className="fixed z-[90] inset-x-0 sm:inset-x-auto bottom-[calc(env(safe-area-inset-bottom)+4rem)] sm:bottom-20 sm:left-1/2 sm:-translate-x-1/2 px-3 sm:px-0">
          <div className="w-full sm:w-auto flex items-center gap-3 px-4 py-3 rounded-2xl sm:rounded-xl border border-[var(--warm)]/30 bg-[var(--surface-2)]/95 backdrop-blur text-[11px] font-mono text-[var(--warm)] animate-slide-up">
            <span className="flex-1 min-w-0 truncate">Mise à jour disponible</span>
            <button
              onClick={handleUpdate}
              className="shrink-0 px-4 py-2 rounded-lg bg-[var(--warm)]/20 hover:bg-[var(--warm)]/30 transition-colors"
            >
              Actualiser
            </button>
            <button
              onClick={() => setUpdateWaiting(null)}
              aria-label="Fermer"
              className="shrink-0 w-9 h-9 -mr-1.5 flex items-center justify-center rounded-lg opacity-50 hover:opacity-100 hover:bg-[var(--surface-3)] transition-opacity"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
