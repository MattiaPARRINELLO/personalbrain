"use client";

import { useEffect, useState, useTransition, useMemo, useRef, useCallback } from "react";
import {
  Plus,
  ExternalLink,
  Trash2,
  Play,
  FileText,
  Image as ImageIcon,
  Music2,
  Globe,
  Filter,
  X,
  Check,
  Search,
  GripVertical,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  loadWatchLater,
  createWatchLaterItem,
  removeWatchLaterItem,
  reorderWatchLater,
} from "@/app/actions/watch-later";
import type { WatchLaterCategory, WatchLaterItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/date";

const categoryMeta: Record<WatchLaterCategory, { label: string; icon: typeof Play; tone: "accent" | "warm" | "success" | "muted" | "danger" }> = {
  video: { label: "Vidéos", icon: Play, tone: "accent" },
  article: { label: "Écrits", icon: FileText, tone: "success" },
  photo: { label: "Photos", icon: ImageIcon, tone: "warm" },
  music: { label: "Musique", icon: Music2, tone: "muted" },
  other: { label: "Autres", icon: Globe, tone: "muted" },
};

const FILTER_ORDER: { id: "all" | WatchLaterCategory; label: string; icon: typeof Play }[] = [
  { id: "all", label: "Tout", icon: Filter },
  { id: "video", label: "Vidéos", icon: Play },
  { id: "article", label: "Articles", icon: FileText },
  { id: "photo", label: "Photos", icon: ImageIcon },
  { id: "music", label: "Musique", icon: Music2 },
  { id: "other", label: "Autres", icon: Globe },
];

type FilterId = "all" | WatchLaterCategory;

export default function WatchLaterPage() {
  const [items, setItems] = useState<WatchLaterItem[] | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSnapshotRef = useRef<WatchLaterItem[] | null>(null);
  const toast = useToast();

  useEffect(() => {
    startTransition(async () => {
      const d = await loadWatchLater();
      setItems(d.items);
    });
  }, []);

  const handleCreate = (input: { url: string; title: string; description?: string; category?: WatchLaterCategory }) => {
    startTransition(async () => {
      const item = await createWatchLaterItem(input);
      setItems((prev) => (prev ? [item, ...prev] : [item]));
      setShowAdd(false);
      toast.show({ message: "Lien ajouté à À voir", tone: "success", duration: 2200 });
    });
  };

  const handleDelete = (id: string) => {
    if (!items) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setItems((prev) => (prev ?? []).filter((x) => x.id !== id));
    const toastId = toast.show({
      message: `Retiré : "${item.title.slice(0, 50)}${item.title.length > 50 ? "…" : ""}"`,
      tone: "default",
      duration: 5000,
      action: {
        label: "Annuler",
        onClick: () => {
          setItems((prev) => (prev ? [item, ...prev] : [item]));
          void createWatchLaterItem({
            url: item.url,
            title: item.title,
            description: item.description,
            category: item.category,
            source: item.source,
          }).then((restored) => {
            setItems((prev) =>
              prev ? prev.map((x) => (x.id === id ? restored : x)) : prev
            );
            toast.dismiss(toastId);
            toast.show({ message: "Lien restauré", tone: "success", duration: 2000 });
          });
        },
      },
    });
    void removeWatchLaterItem(id);
  };

  const persistOrder = useCallback(
    (next: WatchLaterItem[]) => {
      setItems(next);
      const orderedIds = next.map((i) => i.id);
      void reorderWatchLater(orderedIds);
    },
    []
  );

  const handleDragStart = (id: string, currentItems: WatchLaterItem[]) => {
    dragSnapshotRef.current = currentItems;
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== dragOverId) setDragOverId(overId);
  };

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    const dragId = draggingId;
    setDraggingId(null);
    setDragOverId(null);
    if (!dragId || dragId === dropId) return;
    const snap = dragSnapshotRef.current;
    if (!snap) return;
    const fromIdx = snap.findIndex((i) => i.id === dragId);
    const toIdx = snap.findIndex((i) => i.id === dropId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...snap];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    persistOrder(next);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
    dragSnapshotRef.current = null;
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      if (filter !== "all" && item.category !== filter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.source.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filter, query]);

  const counts = useMemo(() => {
    if (!items) return {} as Record<FilterId, number>;
    const c: Record<string, number> = { all: items.length };
    for (const it of items) {
      c[it.category] = (c[it.category] ?? 0) + 1;
    }
    return c as Record<FilterId, number>;
  }, [items]);

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Bookmarks IA"
            title="À voir plus tard"
            description="Liens que tu as partagés avec l'IA ou ajoutés à la main. Filtre par catégorie, retrouve tout au même endroit. Glisse les cartes pour réorganiser."
            actions={
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowAdd(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Ajouter un lien
              </Button>
            }
          />

          {showAdd && (
            <AddItemForm
              onCancel={() => setShowAdd(false)}
              onSubmit={handleCreate}
            />
          )}

          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-1)] overflow-x-auto">
              {FILTER_ORDER.map(({ id, label, icon: Icon }) => {
                const active = filter === id;
                const count = counts[id] ?? 0;
                return (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium font-mono uppercase tracking-wider transition-all duration-200 shrink-0",
                      active
                        ? "bg-[var(--surface-3)] text-[var(--text-1)] shadow-sm"
                        : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                    <span className="text-[9px] text-[var(--text-4)] tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex-1 min-w-[200px] max-w-xs relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-3)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer par titre ou source…"
                className="w-full pl-9 pr-3 py-1.5 bg-[var(--surface-1)] border border-[var(--border-1)] rounded-lg text-[12px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--border-2)] transition-colors"
              />
            </div>
          </div>

          {items === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            items.length === 0 ? (
              <EmptyState
                icon={<Play className="w-5 h-5" />}
                title="Aucun lien enregistré"
                description="Partage un lien à l'IA dans le chat — elle l'ajoutera automatiquement. Ou ajoute-le ici."
              />
            ) : (
              <EmptyState
                icon={<Filter className="w-5 h-5" />}
                title="Aucun résultat"
                description="Aucun élément ne correspond à ce filtre. Essaie une autre catégorie."
              />
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isDragging={draggingId === item.id}
                  isDragOver={dragOverId === item.id && draggingId !== item.id}
                  onDelete={() => handleDelete(item.id)}
                  onDragStart={() => items && handleDragStart(item.id, items)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDrop={(e) => handleDrop(e, item.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ItemCard({
  item,
  isDragging,
  isDragOver,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: WatchLaterItem;
  isDragging: boolean;
  isDragOver: boolean;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-[var(--surface-1)]/40 hover:bg-[var(--surface-2)]/60 transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing",
        isDragging
          ? "opacity-40 border-[var(--accent)]/40"
          : isDragOver
            ? "border-[var(--accent)]/60 ring-2 ring-[var(--accent)]/20 scale-[1.01]"
            : "border-[var(--border-1)] hover:border-[var(--border-2)]"
      )}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <Pill tone={meta.tone} dot>
          <Icon className="w-2.5 h-2.5" />
          {meta.label}
        </Pill>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-4)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors opacity-0 group-hover:opacity-100"
            title="Supprimer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <span className="w-6 h-7 flex items-center justify-center text-[var(--text-4)] opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className="px-4 pb-3 flex-1 flex flex-col"
      >
        {item.thumbnail ? (
          <div className="aspect-video rounded-lg overflow-hidden bg-[var(--surface-2)] mb-3 border border-[var(--border-1)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.thumbnail}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="aspect-video rounded-lg bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-3)] border border-[var(--border-1)] mb-3 flex items-center justify-center text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors duration-300">
            <Icon className="w-7 h-7" strokeWidth={1.5} />
          </div>
        )}
        <h3 className="text-[13.5px] font-medium text-[var(--text-1)] leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
          {item.title}
        </h3>
        {item.description && (
          <p className="text-[11.5px] text-[var(--text-3)] mt-1.5 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}
      </a>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-1)] text-[10px] text-[var(--text-4)] font-mono">
        <span className="truncate">{item.source}</span>
        <span className="shrink-0 ml-2">{formatRelative(item.createdAt)}</span>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className="absolute top-3 right-12 w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors opacity-0 group-hover:opacity-100"
        title="Ouvrir"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </article>
  );
}

function AddItemForm({
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
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          autoFocus
          className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50 font-mono"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
          className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13.5px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optionnel)"
          rows={2}
          className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-2)] placeholder:text-[var(--text-3)] outline-none resize-none focus:border-[var(--accent)]/50"
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
