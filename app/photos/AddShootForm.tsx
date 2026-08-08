"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function AddShootForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (title: string, date: string, client: string, notes?: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [client, setClient] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    if (!title.trim() || !date.trim() || !client.trim()) return;
    onSubmit(title.trim(), date.trim(), client.trim(), notes.trim() || undefined);
  };

  return (
    <div className="border border-[var(--border-1)] rounded-lg p-4 space-y-3 bg-[var(--surface-2)]">
      <h3 className="text-[13px] font-semibold text-[var(--text-1)]">Nouveau shooting</h3>
      <Input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre du shooting"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Input
          type="text"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          placeholder="Client"
        />
      </div>
      <Input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optionnel)"
      />
      <div className="flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!title.trim() || !date.trim() || !client.trim()} leftIcon={<Plus className="w-3.5 h-3.5" />}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
