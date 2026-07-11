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
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
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
        subscribeToPush();
      });
    }
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
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--surface-2)] text-[11px] font-mono text-[var(--accent)] flex items-center gap-3 animate-slide-up">
          <Image src="/backstage-logo-simple.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" />
          <span>Installer BACKSTAGE</span>
          <button
            onClick={handleInstall}
            className="px-2 py-0.5 rounded-lg bg-[var(--accent)]/20 hover:bg-[var(--accent)]/30 transition-colors"
          >
            Installer
          </button>
          <button
            onClick={() => {
              localStorage.setItem("pwa-install-dismissed", "true");
              setDismissed(true);
            }}
            className="opacity-50 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      )}
      {updateWaiting && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 rounded-xl border border-[var(--warm)]/30 bg-[var(--warm)]/10 text-[11px] font-mono text-[var(--warm)] flex items-center gap-3 animate-slide-up">
          <span>Mise à jour disponible</span>
          <button
            onClick={handleUpdate}
            className="px-2 py-0.5 rounded-lg bg-[var(--warm)]/20 hover:bg-[var(--warm)]/30 transition-colors"
          >
            Actualiser
          </button>
          <button
            onClick={() => setUpdateWaiting(null)}
            className="opacity-50 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
