"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaLoader() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateWaiting, setUpdateWaiting] = useState<ServiceWorker | null>(null);
  const [installed, setInstalled] = useState(false);
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
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }
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
