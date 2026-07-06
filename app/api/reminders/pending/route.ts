import { NextResponse } from "next/server";
import { getReminders } from "@/lib/storage";

export async function GET() {
  const data = await getReminders();
  const pending = data.reminders.filter(
    (r) => r.status === "pending" && new Date(r.dueAt).getTime() <= Date.now() + 60000
  );
  return NextResponse.json(
    { reminders: pending },
    { headers: { "sw-cached-at": new Date().toISOString() } }
  );
}
