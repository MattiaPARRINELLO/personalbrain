import { NextRequest, NextResponse } from "next/server";
import { updateReminder } from "@/lib/storage";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await updateReminder(id, { status: "done", notifiedAt: new Date().toISOString() });
  if (!r) return NextResponse.json({ error: "Rappel introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
