"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, X, Brain, Code2, Camera, Heart, User, Search, Sparkles, BarChart3, Share2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { loadBrain, loadMemoryRelationships, rememberFact, editMemoryFact, forgetFact } from "@/app/actions/brain";
import dynamic from "next/dynamic";
import type { MemoryData, MemoryCategory, MemoryFact, MemoryRelationship } from "@/lib/types";

const KnowledgeGraph = dynamic(
  () => import("@/components/brain/KnowledgeGraph").then((m) => ({ default: m.KnowledgeGraph })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] rounded-xl border border-[var(--border-1)] flex items-center justify-center text-[var(--text-2)] text-sm">
        Chargement du graphe…
      </div>
    ),
  }
);
import { cn } from "@/lib/utils";

const categoryMeta: Record<MemoryCategory, { label: string; icon: typeof Code2; tone: "accent" | "warm" | "success" | "muted" }> = {
  dev: { label: "Code", icon: Code2, tone: "accent" },
  photo: { label: "Photo", icon: Camera, tone: "warm" },
  life: { label: "Vie", icon: Heart, tone: "success" },
  preference: { label: "Préférence", icon: User, tone: "muted" },
};

type Filter = "all" | MemoryCategory;

const ALL_FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "dev", label: "Code" },
  { id: "photo", label: "Photo" },
  { id: "life", label: "Vie" },
  { id: "preference", label: "Préférences" },
];

export default function BrainPage() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"facts" | "graph">("facts");
  const [relationships, setRelationships] = useState<MemoryRelationship[]>([]);
  const toast = useToast();

  useEffect(() => {
    Promise.resolve().then(() => {
      startTransition(async () => {
        try {
          const [d, rels] = await Promise.all([loadBrain(), loadMemoryRelationships()]);
          setData(d);
          setRelationships(rels);
        } finally {
          setLoading(false);
        }
      });
    });
  }, []);

  const handleDelete = (id: string) => {
    if (!data) return;
    const fact = data.facts.find((f) => f.id === id);
    if (!fact) return;
    setData({ ...data, facts: data.facts.filter((f) => f.id !== id) });
    const toastId = toast.show({
      message: `Fait supprimé : "${fact.content.slice(0, 60)}${fact.content.length > 60 ? "…" : ""}"`,
      tone: "default",
      duration: 5000,
      action: {
        label: "Annuler",
        onClick: () => {
          setData((prev) => (prev ? { ...prev, facts: [...prev.facts, fact] } : prev));
          void rememberFact(fact.content, fact.category, { source: fact.source, confidence: fact.confidence }).then((restored) => {
            if (data) {
              setData((prev) =>
                prev
                  ? { ...prev, facts: prev.facts.map((f) => (f.id === id ? restored : f)) }
                  : prev
              );
            }
            toast.dismiss(toastId);
            toast.show({ message: "Fait restauré", tone: "success", duration: 2400 });
          });
        },
      },
    });
    void forgetFact(id);
  };

  const handleSaveEdit = (id: string, content: string, category: MemoryCategory) => {
    startTransition(async () => {
      const updated = await editMemoryFact(id, { content, category });
      if (updated && data) {
        setData({
          ...data,
          facts: data.facts.map((f) => (f.id === id ? updated : f)),
        });
        toast.show({ message: "Fait mis à jour", tone: "success", duration: 2200 });
      }
      setEditing(null);
    });
  };

  const handleAdd = (content: string, category: MemoryCategory) => {
    startTransition(async () => {
      const fact = await rememberFact(content, category, { source: "manual" });
      if (data) {
        setData({ ...data, facts: [...data.facts, fact] });
        toast.show({ message: "Fait mémorisé", tone: "success", duration: 2200 });
      }
      setShowAdd(false);
    });
  };

  const grouped = useMemo(() => groupByCategory(data?.facts ?? []), [data]);
  const counts = useMemo(
    () => ({
      dev: grouped.dev?.length ?? 0,
      photo: grouped.photo?.length ?? 0,
      life: grouped.life?.length ?? 0,
      preference: grouped.preference?.length ?? 0,
    }),
    [grouped]
  );

  const filteredFacts = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.facts.filter((f) => {
      if (filter !== "all" && f.category !== filter) return false;
      if (!q) return true;
      return f.content.toLowerCase().includes(q);
    });
  }, [data, filter, search]);

  const filteredGrouped = useMemo(() => groupByCategory(filteredFacts), [filteredFacts]);

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

          <div className="flex gap-1 mb-6 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-1)] w-fit">
            <button
              onClick={() => setTab("facts")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-mono tracking-wider transition-colors flex items-center gap-1.5",
                tab === "facts" ? "bg-[var(--surface-3)] text-[var(--text-1)]" : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              )}
            >
              <Brain className="w-3.5 h-3.5" />
              Faits
            </button>
            <button
              onClick={() => setTab("graph")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-mono tracking-wider transition-colors flex items-center gap-1.5",
                tab === "graph" ? "bg-[var(--surface-3)] text-[var(--text-1)]" : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              )}
            >
              <Share2 className="w-3.5 h-3.5" />
              Graphe
            </button>
          </div>

          {tab === "graph" && data ? (
            <div className="h-[600px] rounded-xl border border-[var(--border-1)] overflow-hidden">
              <KnowledgeGraph
                key={data.facts.length}
                facts={data.facts}
                relationships={relationships}
                onEditFact={(id) => { setEditing(id); setTab("facts"); }}
              />
            </div>
          ) : (
            <>
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="Code" value={counts.dev} icon={Code2} tone="accent" />
              <StatCard label="Photo" value={counts.photo} icon={Camera} tone="warm" />
              <StatCard label="Vie" value={counts.life} icon={Heart} tone="success" />
              <StatCard label="Préférences" value={counts.preference} icon={User} tone="muted" />
            </div>
          )}

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
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-3)]" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher dans la mémoire…"
                    className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-lg pl-9 pr-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-1)]">
                  {ALL_FILTERS.map((f) => {
                    const active = filter === f.id;
                    const count = f.id === "all" ? data.facts.length : counts[f.id as MemoryCategory] ?? 0;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5",
                          active
                            ? "bg-[var(--surface-3)] text-[var(--text-1)]"
                            : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                        )}
                      >
                        {f.label}
                        <span
                          className={cn(
                            "px-1 rounded-sm text-[9px] font-mono",
                            active
                              ? "bg-[var(--accent)]/20 text-[var(--accent-soft)]"
                              : "bg-[var(--surface-3)]/60 text-[var(--text-4)]"
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredFacts.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--border-2)] p-8 text-center">
                  <Sparkles className="w-5 h-5 text-[var(--text-4)] mx-auto mb-2" />
                  <p className="text-[12px] text-[var(--text-3)]">
                    Aucun fait ne correspond à ta recherche.
                  </p>
                </div>
              )}

              {filteredFacts.length > 0 && (
                <div className="space-y-8 mt-2">
                  {(Object.keys(categoryMeta) as MemoryCategory[]).map((cat) => {
                    const facts = filteredGrouped[cat] ?? [];
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
          )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof BarChart3;
  tone: "accent" | "warm" | "success" | "muted";
}) {
  const toneClass =
    tone === "accent"
      ? "text-[var(--accent-soft)] bg-[var(--accent)]/10 border-[var(--accent)]/20"
      : tone === "warm"
        ? "text-[var(--warm)] bg-[var(--warm)]/10 border-[var(--warm)]/20"
        : tone === "success"
          ? "text-[var(--accent-success)] bg-[var(--accent-success)]/10 border-[var(--accent-success)]/20"
          : "text-[var(--text-2)] bg-[var(--surface-2)]/60 border-[var(--border-2)]";
  return (
    <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 p-3.5 flex items-center gap-3 hover:border-[var(--border-2)] transition-colors">
      <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", toneClass)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-3)] font-mono">
          {label}
        </p>
        <p className="text-[18px] font-semibold text-[var(--text-1)] leading-tight tabular-nums">
          {value}
        </p>
      </div>
    </div>
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
    <div className="mb-6 p-5 rounded-2xl border border-[var(--border-1)] bg-gradient-to-br from-[var(--surface-2)]/40 to-[var(--surface-1)]/30">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--warm)]/10 border border-[var(--border-2)] flex items-center justify-center text-[var(--accent)] font-semibold text-[16px]">
          {profile.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)] font-mono">Profil</p>
          <h3 className="text-[15px] font-medium text-[var(--text-1)] mt-0.5">{profile.name}</h3>
          {profile.preferences.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {profile.preferences.map((p) => (
                <Pill key={p} tone="muted" dot>
                  {p}
                </Pill>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FactRow({ fact, onEdit, onDelete }: { fact: MemoryFact; onEdit: () => void; onDelete: () => void }) {
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
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Mémoriser
          </Button>
        </div>
      </div>
    </div>
  );
}
