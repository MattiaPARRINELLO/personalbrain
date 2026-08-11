"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { Plus, Camera } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  loadPhotoShoots, createPhotoShoot, editPhotoShoot, removePhotoShoot,
} from "@/app/actions/photography";
import type { PhotoShoot, PhotoShootsData, PhotoShootStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { STATUS_FLOW } from "./constants";
import { ShootCard } from "./ShootCard";
import { DetailModal } from "./DetailModal";
import { AddShootForm } from "./AddShootForm";
import { GalleryKanban } from "./GalleryKanban";

export default function PhotoShootsPage() {
  const [data, setData] = useState<PhotoShootsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<"shoots" | "delivery">("shoots");
  const [detailShootId, setDetailShootId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<PhotoShootStatus | null>(null);
  const [mobileStatus, setMobileStatus] = useState<PhotoShootStatus | "all">("all");

  useEffect(() => {
    loadPhotoShoots()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const byStatus = useMemo(() => {
    if (!data) return {} as Record<PhotoShootStatus, PhotoShoot[]>;
    const map: Record<PhotoShootStatus, PhotoShoot[]> = {
      upcoming: [], done: [], on_pc: [], sorted: [], edited: [], exported: [], sent: [],
    };
    for (const s of data.shoots) {
      if (map[s.status]) map[s.status].push(s);
    }
    return map;
  }, [data]);

  const displayedShoots = useMemo(() => {
    if (!data) return [];
    if (mobileStatus === "all") return data.shoots;
    return data.shoots.filter((s) => s.status === mobileStatus);
  }, [data, mobileStatus]);

  const detailShoot = useMemo(
    () => data?.shoots.find((s) => s.id === detailShootId) ?? null,
    [data, detailShootId]
  );

  const handleAdd = async (title: string, date: string, client: string, notes?: string) => {
    startTransition(async () => {
      try {
        const shoot = await createPhotoShoot({ title, date, client, notes });
        setData((prev) => prev ? { shoots: [...prev.shoots, shoot] } : { shoots: [shoot] });
        setShowAdd(false);
      } catch {}
    });
  };

  const handleStatusChange = async (id: string, newStatus: PhotoShootStatus) => {
    const old = data?.shoots.find((s) => s.id === id);
    setData((prev) => prev ? {
      shoots: prev.shoots.map((s) => s.id === id ? { ...s, status: newStatus, updatedAt: new Date().toISOString() } : s),
    } : prev);
    const result = await editPhotoShoot(id, { status: newStatus });
    if (!result) {
      if (old) setData((prev) => prev ? { shoots: prev.shoots.map((s) => s.id === id ? old : s) } : prev);
    }
  };

  const handleUpdateSent = async (id: string, galleryLink: string, photosSent: number) => {
    const old = data?.shoots.find((s) => s.id === id);
    setData((prev) => prev ? {
      shoots: prev.shoots.map((s) => s.id === id ? { ...s, status: "sent", galleryLink, photosSent, updatedAt: new Date().toISOString() } : s),
    } : prev);
    const result = await editPhotoShoot(id, { status: "sent", galleryLink, photosSent });
    if (!result) {
      if (old) setData((prev) => prev ? { shoots: prev.shoots.map((s) => s.id === id ? old : s) } : prev);
    }
  };

  const handleEdit = async (id: string, updates: Partial<{ title: string; date: string; client: string; notes: string }>) => {
    const old = data?.shoots.find((s) => s.id === id);
    setData((prev) => prev ? {
      shoots: prev.shoots.map((s) => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s),
    } : prev);
    const result = await editPhotoShoot(id, updates);
    if (!result) {
      if (old) setData((prev) => prev ? { shoots: prev.shoots.map((s) => s.id === id ? old : s) } : prev);
    }
  };

  const handleDelete = async (id: string) => {
    const old = data?.shoots.find((s) => s.id === id);
    setData((prev) => prev ? { shoots: prev.shoots.filter((s) => s.id !== id) } : prev);
    const ok = await removePhotoShoot(id);
    if (!ok && old) {
      setData((prev) => prev ? { shoots: [...prev.shoots, old] } : prev);
    }
    setDetailShootId(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, status: PhotoShootStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  };

  const handleDragLeave = (status: PhotoShootStatus) => {
    if (dragOverCol === status) setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, status: PhotoShootStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) handleStatusChange(id, status);
    setDraggedId(null);
    setDragOverCol(null);
  };

  return (
    <AppShell>
      <div className="flex flex-col h-full min-w-0">
        <div className="px-6 pt-6">
          <PageHeader
            eyebrow="Photographie"
            title="Photos"
            description="Shootings et livraisons photo au même endroit."
            actions={
              !showAdd && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-md border border-[var(--border-2)] overflow-hidden">
                    <button
                      onClick={() => setView("shoots")}
                      className={cn(
                        "px-3 h-8 text-[12px] font-medium transition-colors",
                        view === "shoots"
                          ? "bg-[var(--surface-2)] text-[var(--text-1)]"
                          : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                      )}
                    >
                      Shootings
                    </button>
                    <button
                      onClick={() => setView("delivery")}
                      className={cn(
                        "px-3 h-8 text-[12px] font-medium transition-colors",
                        view === "delivery"
                          ? "bg-[var(--surface-2)] text-[var(--text-1)]"
                          : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                      )}
                    >
                      Livraison
                    </button>
                  </div>
                  {view === "shoots" && (
                    <Button variant="primary" size="sm" onClick={() => setShowAdd(true)} leftIcon={<Plus className="w-3 h-3" />}>
                      Nouveau shooting
                    </Button>
                  )}
                </div>
              )
            }
          />
        </div>

        {showAdd && (
          <div className="px-6 pb-4">
            <AddShootForm
              onSubmit={handleAdd}
              onCancel={() => setShowAdd(false)}
            />
          </div>
        )}

        {view === "delivery" ? (
          <div className="flex-1 min-h-0 overflow-y-auto pt-2">
            <GalleryKanban />
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 pb-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
        ) : !data || data.shoots.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <EmptyState
              icon={<Camera className="w-6 h-6" />}
              title="Aucun shooting"
              description="Ajoute ton premier shooting photo pour commencer le suivi."
              action={
                <Button variant="primary" size="sm" onClick={() => setShowAdd(true)} leftIcon={<Plus className="w-3 h-3" />}>
                  Ajouter un shooting
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop: kanban board */}
            <div className="hidden md:flex flex-1 overflow-x-auto pb-4">
              <div className="flex gap-0 h-full px-6">
                {STATUS_FLOW.map((col) => {
                  const items = byStatus[col.key];
                  const isOver = dragOverCol === col.key;
                  return (
                    <div
                      key={col.key}
                      className={cn(
                        "flex flex-col flex-1 min-w-[200px] border-r border-[var(--border-1)] last:border-r-0",
                        "transition-colors duration-150",
                        isOver && "bg-[var(--accent)]/5"
                      )}
                      onDragOver={(e) => handleDragOver(e, col.key)}
                      onDragLeave={() => handleDragLeave(col.key)}
                      onDrop={(e) => handleDrop(e, col.key)}
                    >
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-1)]">
                        <span
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: col.color }}
                        />
                        <h3 className="text-[11px] font-mono uppercase tracking-widest text-[var(--text-2)]">
                          {col.label}
                        </h3>
                        <span className="text-[10px] text-[var(--text-4)] font-mono ml-auto">{items.length}</span>
                      </div>

                      <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {items.length === 0 && (
                          <div className="flex items-center justify-center h-24 border-2 border-dashed border-[var(--border-1)] rounded-lg text-[11px] text-[var(--text-4)] font-mono uppercase tracking-wider">
                            Déposer ici
                          </div>
                        )}
                        {items.map((shoot) => (
                          <div
                            key={shoot.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, shoot.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              "transition-opacity duration-150",
                              draggedId === shoot.id && "opacity-30"
                            )}
                          >
                            <ShootCard
                              shoot={shoot}
                              onStatusChange={(s) => handleStatusChange(shoot.id, s)}
                              onDelete={() => handleDelete(shoot.id)}
                              onUpdateSent={(link, count) => handleUpdateSent(shoot.id, link, count)}
                              onDetail={() => setDetailShootId(shoot.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile: filter pills + card list */}
            <div className="md:hidden flex-1 flex flex-col min-h-0">
              <div className="flex gap-1.5 px-4 py-3 overflow-x-auto flex-shrink-0">
                <Pill
                  tone={mobileStatus === "all" ? "accent" : "neutral"}
                  onClick={() => setMobileStatus("all")}
                >
                  Tous
                </Pill>
                {STATUS_FLOW.map((col) => (
                  <Pill
                    key={col.key}
                    tone={mobileStatus === col.key ? "accent" : "neutral"}
                    onClick={() => setMobileStatus(col.key)}
                  >
                    {col.label}
                  </Pill>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                {displayedShoots.map((shoot) => (
                  <ShootCard
                    key={shoot.id}
                    shoot={shoot}
                    onStatusChange={(s) => handleStatusChange(shoot.id, s)}
                    onDelete={() => handleDelete(shoot.id)}
                    onUpdateSent={(link, count) => handleUpdateSent(shoot.id, link, count)}
                    onDetail={() => setDetailShootId(shoot.id)}
                  />
                ))}
                {displayedShoots.length === 0 && (
                  <div className="flex items-center justify-center h-32 text-[12px] text-[var(--text-4)] font-mono">
                    Aucun shooting dans ce statut
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {detailShoot && (
        <DetailModal
          shoot={detailShoot}
          onClose={() => setDetailShootId(null)}
          onEdit={(updates) => handleEdit(detailShoot.id, updates)}
          onDelete={() => handleDelete(detailShoot.id)}
        />
      )}
    </AppShell>
  );
}

/* ---------- ShootCard ---------- */



/* ---------- DetailModal ---------- */



/* ---------- AddShootForm ---------- */

