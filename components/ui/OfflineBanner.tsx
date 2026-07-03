"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const [online, setOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      setShow(true);
      setTimeout(() => setShow(false), 3000);
    }
    function handleOffline() {
      setOnline(false);
      setShow(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 rounded-xl border text-[11px] font-mono transition-all duration-500",
        online
          ? "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]"
          : "border-[var(--warm)]/30 bg-[var(--warm)]/10 text-[var(--warm)]"
      )}
      style={{
        animation: show ? "slide-up 280ms ease-out" : "fade-out 300ms ease-in forwards",
      }}
    >
      {online ? "🟢 Connecté" : "🟡 Mode hors-ligne — les données sont en cache"}
    </div>
  );
}
