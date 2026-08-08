"use client";

import { useState } from "react";
import { X, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import type { MemoryCategory, MemoryFact } from "@/lib/types";
import { cn } from "@/lib/utils";
import { categoryMeta } from "./memory-utils";

function CategoryPicker({
  selected,
  onSelect,
}: {
  selected: MemoryCategory;
  onSelect: (c: MemoryCategory) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(categoryMeta) as MemoryCategory[]).map((c) => (
        <button
          key={c}
          onClick={() => onSelect(c)}
          className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-colors",
            selected === c
              ? "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-1)]"
          )}
        >
          {categoryMeta[c].label}
        </button>
      ))}
    </div>
  );
}

export function EditFactForm({
  fact,
  onSave,
  onCancel,
}: {
  fact: MemoryFact;
  onSave: (id: string, content: string, category: MemoryCategory) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(fact.content);
  const [category, setCategory] = useState<MemoryCategory>(fact.category);

  return (
    <div className="p-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 fade-in">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
      />
      <div className="flex items-center justify-between mt-3 gap-2">
        <CategoryPicker selected={category} onSelect={setCategory} />
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={onCancel} leftIcon={<X className="w-3.5 h-3.5" />}>
            Annuler
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSave(fact.id, content, category)}
            disabled={!content.trim()}
            leftIcon={<Check className="w-3.5 h-3.5" />}
          >
            Sauver
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AddFactForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (content: string, category: MemoryCategory) => void;
}) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("life");

  return (
    <div className="mb-6 p-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 fade-in">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] font-mono mb-3">
        Nouveau fait à mémoriser
      </p>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Ex : Préfère coder en TypeScript avec des fonctions pures."
        rows={2}
        autoFocus
      />
      <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
        <CategoryPicker selected={category} onSelect={setCategory} />
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSubmit(content, category)}
            disabled={!content.trim()}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Mémoriser
          </Button>
        </div>
      </div>
    </div>
  );
}
