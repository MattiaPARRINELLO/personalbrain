"use client";

import { Pencil, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { MemoryFact } from "@/lib/types";

export function FactRow({ fact, onEdit, onDelete }: { fact: MemoryFact; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-start gap-3 p-4 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]/50 transition-all duration-200">
      <span className="shrink-0 w-1 self-stretch rounded-full bg-[var(--accent)]/30" />
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] text-[var(--text-1)] leading-relaxed">
          {fact.content}
        </p>
        {fact.source === "auto-extract" && fact.confidence !== undefined && (
          <p className="text-[10px] text-[var(--text-4)] font-mono mt-1.5 uppercase tracking-wider">
            mémorisé auto · confiance {Math.round(fact.confidence * 100)}%
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconButton label="Modifier" onClick={onEdit}>
          <Pencil className="w-3 h-3" />
        </IconButton>
        <IconButton label="Supprimer" tone="danger" onClick={onDelete}>
          <Trash2 className="w-3 h-3" />
        </IconButton>
      </div>
    </div>
  );
}
