"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type { WatchLaterCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { categoryMeta } from "./meta";

export function AddItemForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (input: { url: string; title: string; description?: string; category?: WatchLaterCategory }) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<WatchLaterCategory>("other");

  const handleSubmit = () => {
    if (!url.trim() || !title.trim()) return;
    onSubmit({ url: url.trim(), title: title.trim(), description: description.trim() || undefined, category });
  };

  return (
    <div className="mb-6 p-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 fade-in">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] font-mono mb-3">
        Nouveau lien
      </p>
      <div className="space-y-2.5">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          autoFocus
          className="font-mono"
        />
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optionnel)"
          rows={2}
        />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(categoryMeta) as WatchLaterCategory[]).map((c) => {
            const meta = categoryMeta[c];
            const Icon = meta.icon;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-colors",
                  category === c
                    ? "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-1)]"
                )}
              >
                <Icon className="w-2.5 h-2.5" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-3">
        <Button variant="ghost" size="sm" onClick={onCancel} leftIcon={<X className="w-3.5 h-3.5" />}>
          Annuler
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!url.trim() || !title.trim()}
          leftIcon={<Check className="w-3.5 h-3.5" />}
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
}
