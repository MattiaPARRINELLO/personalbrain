"use client";

import { BellRing, BellOff, Bell } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import type { NotificationPermissionState } from "@/lib/notifications";

export function PermissionPill({
  permission,
  onRequest,
}: {
  permission: NotificationPermissionState;
  onRequest: () => void;
}) {
  if (permission === "granted") {
    return (
      <Pill tone="success" dot>
        <BellRing className="w-3 h-3" />
        <span className="hidden sm:inline">Notifications actives</span>
      </Pill>
    );
  }
  if (permission === "denied") {
    return (
      <Pill tone="danger" dot>
        <BellOff className="w-3 h-3" />
        <span className="hidden sm:inline">Refusées</span>
      </Pill>
    );
  }
  if (permission === "unsupported") return null;
  return (
    <Button variant="outline" size="sm" onClick={onRequest} leftIcon={<Bell className="w-3.5 h-3.5" />}>
      <span className="hidden sm:inline">Activer</span>
    </Button>
  );
}
