import { NextRequest, NextResponse } from "next/server";
import { getReminders, addReminder, computeNextRecurrence } from "@/lib/storage";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getReminders();
  const reminder = data.reminders.find((r) => r.id === id);
  if (!reminder) return NextResponse.json({ error: "Rappel introuvable" }, { status: 404 });

  const nextDue = computeNextRecurrence(reminder.dueAt, reminder.recurrence);
  if (!nextDue) return NextResponse.json({ ok: false, reason: "Pas de récurrence" });

  await addReminder({
    title: reminder.title,
    notes: reminder.notes,
    dueAt: nextDue,
    recurrence: reminder.recurrence,
  });

  return NextResponse.json({ ok: true, nextDue });
}
