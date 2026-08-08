"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * La landing page est publique ; une fois l'app installée (PWA), elle doit
 * ouvrir directement l'espace personnel, pas la page marketing.
 */
export function InstalledRedirect() {
  const router = useRouter();

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true;
    if (standalone) {
      router.replace("/chat");
    }
  }, [router]);

  return null;
}
