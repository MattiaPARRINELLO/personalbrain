"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, Brain, Code2, Camera, Heart, User } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { loadBrain, rememberFact, editMemoryFact, forgetFact } from "@/app/actions/brain";
import type { MemoryData, MemoryCategory, MemoryFact } from "@/lib/types";
import { cn } from "@/lib/utils";

const categoryMeta: Record<MemoryCategory, { label: string; icon: typeof Code2; tone: "accent" | "warm" | "success" | "muted" }> = {
  dev: { label: "Code", icon: Code2, tone: "accent" },
  photo: { label: "Photo", icon: Camera, tone: "warm" },
  life: { label: "Vie", icon: Heart, tone: "success" },
  preference: { label: "Préférence", icon: User, tone: "muted" },
};

export default function BrainPage() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      startTransition(async () => {
        try {
          const d = await loadBrain();
          setData(d);
        } finally {
          setLoading(false);
        }
      });
    });
  }, []);

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      const ok = await forgetFact(id);
      if (ok && data) {
        setData({ ...data, facts: data.facts.filter((f) => f.id !== id) });
      }
    });
  };

  const handleSaveEdit = async (id: string, content: string, category: MemoryCategory) => {
    startTransition(async () => {
      const updated = await editMemoryFact(id, { content, category });
      if (updated && data) {
        setData({
          ...data,
          facts: data.facts.map((f) => (f.id === id ? updated : f)),
        });
      }
      setEditing(null);
    });
  };

  const handleAdd = async (content: string, category: MemoryCategory) => {
    startTransition(async () => {
      const fact = await rememberFact(content, category);
      if (data) {
        setData({ ...data, facts: [...data.facts, fact] });
      }
      setShowAdd(false);
    });
  };

  const grouped = groupByCategory(data?.facts ?? []);

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Mémoire longue durée"
            title="Cerveau"
            description="Tout ce que l'IA sait de toi. Modifie ou supprime ce qui ne te représente plus. L'IA utilise ces faits pour personnaliser ses réponses."
            actions={
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowAdd(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Ajouter un fait
              </Button>
            }
          />

          {showAdd && (
            <AddFactForm
              onCancel={() => setShowAdd(false)}
              onSubmit={handleAdd}
            />
          )}

          {data && (
            <ProfileCard profile={data.profile} />
          )}

          {loading && !data && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          )}

          {data && data.facts.length === 0 && (
            <EmptyState
              icon={<Brain className="w-5 h-5" />}
              title="Aucune mémoire pour l'instant"
              description="L'IA peut mémoriser des faits à ta place via le chat, ou tu peux les ajouter manuellement ici."
            />
          )}

          {data && data.facts.length > 0 && (
            <div className="space-y-8 mt-2">
              {(Object.keys(categoryMeta) as MemoryCategory[]).map((cat) => {
                const facts = grouped[cat] ?? [];
                if (facts.length === 0) return null;
                const meta = categoryMeta[cat];
                const Icon = meta.icon;
                return (
                  <section key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-3.5 h-3.5 text-[var(--text-3)]" />
                      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-3)] font-mono">
                        {meta.label}
                      </h2>
                      <span className="text-[10px] text-[var(--text-4)] font-mono">
                        {facts.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {facts.map((fact) =>
                        editing === fact.id ? (
                          <EditFactForm
                            key={fact.id}
                            fact={fact}
                            onCancel={() => setEditing(null)}
                            onSave={handleSaveEdit}
                          />
                        ) : (
                          <FactRow
                            key={fact.id}
                            fact={fact}
                            onEdit={() => setEditing(fact.id)}
                            onDelete={() => handleDelete(fact.id)}
                          />
                        )
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function groupByCategory(facts: MemoryFact[]): Record<MemoryCategory, MemoryFact[]> {
  const out: Record<MemoryCategory, MemoryFact[]> = {
    dev: [],
    photo: [],
    life: [],
    preference: [],
  };
  for (const f of facts) out[f.category].push(f);
  for (const k of Object.keys(out) as MemoryCategory[]) {
    out[k].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
  return out;
}

function ProfileCard({ profile }: { profile: MemoryData["profile"] }) {
  return (
    <div className="mb-8 p-5 rounded-2xl border border-[var(--border-1)] bg-gradient-to-br from-[var(--surface-2)]/40 to-[var(--surface-1)]/30">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--warm)]/10 border border-[var(--border-2)] flex items-center justify-center text-[var(--accent)] font-semibold text-[16px]">
          {profile.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)] font-mono">Profil</p>
          <h3 className="text-[15px] font-medium text-[var(--text-1)] mt-0.5">{profile.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {profile.preferences.map((p) => (
              <Pill key={p} tone="muted" dot>
                {p}
              </Pill>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FactRow({ fact, onEdit, onDelete }: { fact: MemoryFact; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-start gap-3 p-4 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]/50 transition-all duration-200">
      <span className="shrink-0 w-1 self-stretch rounded-full bg-[var(--accent)]/30" />
      <p className="flex-1 min-w-0 text-[13.5px] text-[var(--text-1)] leading-relaxed">
        {fact.content}
      </p>
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors"
          title="Modifier"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
          title="Supprimer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function EditFactForm({
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
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13.5px] text-[var(--text-1)] outline-none resize-none focus:border-[var(--accent)]/50"
      />
      <div className="flex items-center justify-between mt-3 gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(categoryMeta) as MemoryCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-colors",
                category === c
                  ? "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-1)]"
              )}
            >
              {categoryMeta[c].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={onCancel} leftIcon={<X className="w-3 h-3" />}>
            Annuler
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSave(fact.id, content, category)}
            disabled={!content.trim()}
            leftIcon={<Check className="w-3 h-3" />}
          >
            Sauver
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddFactForm({
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
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Ex : Préfère coder en TypeScript avec des fonctions pures."
        rows={2}
        autoFocus
        className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13.5px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none resize-none focus:border-[var(--accent)]/50"
      />
      <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(categoryMeta) as MemoryCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-colors",
                category === c
                  ? "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-1)]"
              )}
            >
              {categoryMeta[c].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSubmit(content, category)}
            disabled={!content.trim()}
            leftIcon={<Plus className="w-3 h-3" />}
          >
            Mémoriser
          </Button>
        </div>
      </div>
    </div>
  );
}
