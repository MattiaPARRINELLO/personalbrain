"use client";

import { useMemo, useState } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type { Reminder, ReminderRecurrence } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toLocalInputValue, fromLocalInputValue } from "@/lib/date";
import { RECURRENCE_META } from "./timeline";

export type ReminderFormInput = {
  title: string;
  notes?: string;
  dueAt: string;
  recurrence?: ReminderRecurrence;
};

export function ReminderForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: Reminder;
  onCancel: () => void;
  onSubmit: (input: ReminderFormInput) => void;
}) {
  const defaultDue = useMemo(() => {
    if (initial) return toLocalInputValue(initial.dueAt);
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    return toLocalInputValue(oneHourFromNow.toISOString());
  }, [initial]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dueAt, setDueAt] = useState(defaultDue);
  const [recurrence, setRecurrence] = useState<ReminderRecurrence | undefined>(initial?.recurrence);

  return (
    <div className="mb-6 p-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 fade-in">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] font-mono mb-3">
        {initial ? "Modifier le rappel" : "Nouveau rappel"}
      </p>
      <div className="space-y-2.5">
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre du rappel"
          aria-label="Titre du rappel"
          autoFocus
        />
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optionnel)"
          aria-label="Notes"
          rows={2}
        />
        <div className="flex items-center gap-2">
          <label
            htmlFor="reminder-due"
            className="text-[11px] text-[var(--text-3)] font-mono uppercase tracking-wider shrink-0"
          >
            Échéance
          </label>
          <Input
            id="reminder-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="flex-1 text-[12.5px] font-mono"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[11px] text-[var(--text-3)] font-mono uppercase tracking-wider shrink-0">
            Récurrence
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Récurrence">
            <button
              type="button"
              onClick={() => setRecurrence(undefined)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-colors",
                !recurrence
                  ? "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-1)]"
              )}
            >
              Aucune
            </button>
            {(Object.keys(RECURRENCE_META) as ReminderRecurrence[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRecurrence(r)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-colors",
                  recurrence === r
                    ? "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-1)]"
                )}
              >
                {RECURRENCE_META[r].label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-3">
        <Button variant="ghost" size="sm" onClick={onCancel} leftIcon={<X className="w-3.5 h-3.5" />}>
          Annuler
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSubmit({ title, notes: notes || undefined, dueAt: fromLocalInputValue(dueAt), recurrence })}
          disabled={!title.trim() || !dueAt}
          leftIcon={<Check className="w-3.5 h-3.5" />}
        >
          {initial ? "Sauver" : "Créer"}
        </Button>
      </div>
    </div>
  );
}
