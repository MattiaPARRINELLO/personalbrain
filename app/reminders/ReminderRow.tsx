"use client";

import { Check, Trash2, Pencil, RotateCcw, Clock, CloudOff } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import type { Reminder } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatRelative, isOverdue } from "@/lib/date";
import { RECURRENCE_META } from "./timeline";

export function ReminderRow({
  reminder,
  msLinked,
  onToggle,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  msLinked?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overdue = reminder.status === "pending" && isOverdue(reminder.dueAt);
  return (
    <li
      className={cn(
        "group flex items-start gap-3 p-4 rounded-xl border transition-all duration-200",
        reminder.status === "done"
          ? "border-[var(--border-1)] bg-[var(--surface-1)]/40"
          : overdue
            ? "border-[var(--danger)]/30 bg-[var(--danger)]/5"
            : "border-[var(--border-1)] bg-[var(--surface-1)]/40 hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]/40"
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 mt-0.5",
          reminder.status === "done"
            ? "bg-[var(--success)] border-[var(--success)] text-[#0a0a0b]"
            : "border-[var(--border-2)] hover:border-[var(--accent)]"
        )}
        title={reminder.status === "done" ? "Marquer en attente" : "Marquer comme fait"}
      >
        {reminder.status === "done" && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[14px] leading-snug",
            reminder.status === "done" ? "line-through text-[var(--text-3)]" : "text-[var(--text-1)]"
          )}
        >
          {reminder.title}
        </p>
        {reminder.notes && (
          <p className="text-[12px] text-[var(--text-3)] mt-1 leading-relaxed">{reminder.notes}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Pill tone={overdue ? "danger" : reminder.status === "done" ? "muted" : "accent"} dot>
            <Clock className="w-2.5 h-2.5 mr-0.5" />
            {overdue ? "En retard" : formatRelative(reminder.dueAt)}
          </Pill>
          <span className="text-[10px] text-[var(--text-4)] font-mono hidden sm:inline">
            {new Date(reminder.dueAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          {reminder.recurrence && (
            <span className="text-[10px] text-[var(--text-3)] font-mono uppercase tracking-wider inline-flex items-center gap-1">
              <RotateCcw className="w-2.5 h-2.5" />
              {RECURRENCE_META[reminder.recurrence].label}
            </span>
          )}
          {msLinked && reminder.status === "pending" && !reminder.microsoftTaskId && (
            <span
              className="text-[10px] text-[var(--text-3)] font-mono uppercase tracking-wider inline-flex items-center gap-1"
              title="Non synchronisé avec Microsoft To Do (sync échouée ou rappel créé avant la liaison)"
            >
              <CloudOff className="w-2.5 h-2.5" />
              Non synchronisé
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors"
          title="Modifier"
          aria-label="Modifier le rappel"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
          title="Supprimer"
          aria-label="Supprimer le rappel"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}
