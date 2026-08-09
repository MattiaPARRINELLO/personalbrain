"use server";

import { requireSession } from "@/lib/session";

export interface DailyBriefLaunchResult {
  sent: boolean;
  devices: number;
}

export async function launchDailyBrief(): Promise<DailyBriefLaunchResult> {
  await requireSession();

  const { triggerDailyBrief } = await import("@/lib/notification-scheduler");
  const result = await triggerDailyBrief();
  if (!result) {
    throw new Error("Brief du jour desactive ou generation impossible");
  }
  return result;
}
