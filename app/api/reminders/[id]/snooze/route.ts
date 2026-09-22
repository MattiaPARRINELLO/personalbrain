import { NextRequest, NextResponse } from "next/server";
import { updateReminder } from "@/lib/storage";
import { requireSession } from "@/lib/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  const r = await updateReminder(id, { dueAt: now.toISOString(), status: "snoozed" });
  if (!r) return NextResponse.json({ error: "Rappel introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
