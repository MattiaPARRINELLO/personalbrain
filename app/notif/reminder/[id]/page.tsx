import { notFound } from "next/navigation";
import Link from "next/link";
import { getReminders } from "@/lib/storage";
import { formatRelative, isOverdue } from "@/lib/date";
import { ArrowLeft, Bell, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Rappel — BACKSTAGE",
  robots: { index: false, follow: false },
};

export default async function ReminderNotifPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getReminders();
  const reminder = data.reminders.find((r) => r.id === id);

  if (!reminder) notFound();

  const overdue = isOverdue(reminder.dueAt);
  const isDone = reminder.status === "done";

  return (
    <>
      <Link
        href="/reminders"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--text-4)] hover:text-[var(--text-2)] transition-colors duration-200 mb-8"
      >
        <ArrowLeft className="w-3 h-3" />
        Rappels
      </Link>

      <div className={cn("p-6 rounded-2xl border bg-[var(--surface-1)]", isDone ? "border-[var(--border-1)]" : overdue ? "border-[var(--warm)]" : "border-[var(--border-2)]")}>
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              isDone
                ? "bg-[var(--surface-2)] text-[var(--text-4)]"
                : overdue
                  ? "bg-[var(--warm)]/10 text-[var(--warm)]"
                  : "bg-[var(--accent-cool)]/10 text-[var(--accent-cool)]"
            )}
          >
            {isDone ? <Bell className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          </div>
          <div>
            <h1
              className={cn(
                "text-lg font-mono uppercase tracking-wider",
                isDone ? "text-[var(--text-3)] line-through" : "text-[var(--text-1)]"
              )}
            >
              {reminder.title}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 text-xs font-mono text-[var(--text-3)]">
                <Clock className="w-3 h-3" />
                {formatRelative(reminder.dueAt)}
              </span>
              <span
                className={cn(
                  "text-xs font-mono uppercase px-2 py-0.5 rounded-full border",
                  isDone
                    ? "border-[var(--border-1)] text-[var(--text-4)] bg-transparent"
                    : overdue
                      ? "border-[var(--warm)]/30 text-[var(--warm)] bg-[var(--warm)]/5"
                      : "border-[var(--accent-cool)]/30 text-[var(--accent-cool)] bg-[var(--accent-cool)]/5"
                )}
              >
                {isDone ? "Terminé" : overdue ? "En retard" : reminder.status === "snoozed" ? "Repoussé" : "À venir"}
              </span>
            </div>
          </div>
        </div>

        {reminder.notes && (
          <div className="mt-5 pt-5 border-t border-[var(--border-1)]">
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{reminder.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
