"use client";

import { useEffect } from "react";
import { isCapacitor } from "@/lib/capacitor";
import { registerCapacitorPush } from "@/lib/capacitor-push";

export function CapacitorPushSetup() {
  useEffect(() => {
    if (isCapacitor()) {
      registerCapacitorPush();
    }
  }, []);

  return null;
}
