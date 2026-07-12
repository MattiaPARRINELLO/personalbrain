"use client";

import { useEffect } from "react";
import { isCapacitor } from "@/lib/capacitor";

export function CapacitorSplashScreen() {
  useEffect(() => {
    if (!isCapacitor()) return;

    async function hideSplash() {
      const { SplashScreen } = await import("@capacitor/splash-screen");
      await SplashScreen.hide();
    }

    const timeout = setTimeout(hideSplash, 3000);
    window.addEventListener("load", hideSplash, { once: true });

    return () => clearTimeout(timeout);
  }, []);

  return null;
}
