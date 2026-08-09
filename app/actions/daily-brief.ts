"use server";

import { requireSession } from "@/lib/session";

export type DailyBriefLaunchResult =
  | { sent: boolean; devices: number }
  | { skipped: string };

export async function launchDailyBrief(): Promise<DailyBriefLaunchResult> {
  await requireSession();

  const { triggerDailyBrief } = await import("@/lib/notification-scheduler");
  return triggerDailyBrief();
}
