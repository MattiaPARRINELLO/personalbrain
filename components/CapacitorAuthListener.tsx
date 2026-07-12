"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isCapacitor } from "@/lib/capacitor";
import { onCapTokenReceived, setupCapacitorAuthListener, setCapSessionCookie, parseTokenFromFragment } from "@/lib/capacitor-auth";

export function CapacitorAuthListener() {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (!isCapacitor()) return;

    setupCapacitorAuthListener();

    // Check if this load was triggered by a token in the hash (handled by appUrlOpen)
    // Also listen for in-page token callbacks
    const unsub = onCapTokenReceived(async (token) => {
      if (handled.current) return;
      handled.current = true;

      try {
        await setCapSessionCookie(token);
        window.location.href = window.location.origin;
      } catch {
        // fallback: reload current page
        window.location.reload();
      }
    });

    return unsub;
  }, [router]);

  return null;
}
