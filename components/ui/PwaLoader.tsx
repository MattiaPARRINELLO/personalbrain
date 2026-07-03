"use client";

import { useEffect } from "react";

export function PwaLoader() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
        .then(() => navigator.serviceWorker.register("/sw.js"))
        .catch(() => {});
    }
  }, []);

  return null;
}
