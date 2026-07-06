import { NextRequest, NextResponse } from "next/server";
import { updateReminder } from "@/lib/storage";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  const r = await updateReminder(id, { dueAt: now.toISOString(), status: "snoozed" });
  if (!r) return NextResponse.json({ error: "Rappel introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
