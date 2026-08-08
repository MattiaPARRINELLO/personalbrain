"use client";

import { useEffect, useState, useTransition, useMemo, useRef, useCallback } from "react";
import { Plus, Search, Play, Filter } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  loadWatchLater,
  createWatchLaterItem,
  removeWatchLaterItem,
  reorderWatchLater,
} from "@/app/actions/watch-later";
import type { WatchLaterCategory, WatchLaterItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FILTER_ORDER, type FilterId } from "./meta";
import { ItemCard } from "./ItemCard";
import { AddItemForm } from "./AddItemForm";

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
                        ? "bg-[var(--surface-3)] text-[var(--text-1)]"
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
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer par titre ou source…"
                className="pl-9 pr-3 py-1.5 rounded-lg text-[12px] focus:border-[var(--border-2)]"
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



