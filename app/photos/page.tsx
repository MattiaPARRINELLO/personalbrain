"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import {
  Plus, X, Camera, GripVertical, ExternalLink,
} from "lucide-react";
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

const STATUS_FLOW: { key: PhotoShootStatus; label: string; color: string }[] = [
  { key: "upcoming", label: "À VENIR", color: "var(--text-3)" },
  { key: "done", label: "FAIT", color: "var(--accent)" },
  { key: "on_pc", label: "SUR PC", color: "var(--accent-cool)" },
  { key: "sorted", label: "TRIÉ", color: "var(--warm)" },
  { key: "edited", label: "RETOUCHÉ", color: "var(--accent)" },
  { key: "exported", label: "EXPORTÉ", color: "var(--accent-soft)" },
  { key: "sent", label: "ENVOYÉ", color: "var(--success)" },
];

const STATUS_ORDER: PhotoShootStatus[] = [
  "upcoming", "done", "on_pc", "sorted", "edited", "exported", "sent",
];

const STATUS_PILL_TONE: Record<PhotoShootStatus, "neutral" | "accent" | "warm" | "success" | "danger" | "muted"> = {
  upcoming: "neutral",
  done: "accent",
  on_pc: "accent",
  sorted: "warm",
  edited: "accent",
  exported: "warm",
  sent: "success",
};

function statusIndex(s: PhotoShootStatus): number {
  return STATUS_ORDER.indexOf(s);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function PhotoShootsPage() {
  const [data, setData] = useState<PhotoShootsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [detailShootId, setDetailShootId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<PhotoShootStatus | null>(null);

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
      <div className="flex flex-col h-full">
        <PageHeader
          eyebrow="Photographie"
          title="Photos"
          description="Suivi des shootings — du tournage à la livraison"
          actions={
            !showAdd && (
              <Button variant="primary" size="sm" onClick={() => setShowAdd(true)} leftIcon={<Plus className="w-3 h-3" />}>
                Nouveau shooting
              </Button>
            )
          }
        />

        {showAdd && (
          <div className="px-6 pb-4">
            <AddShootForm
              onSubmit={handleAdd}
              onCancel={() => setShowAdd(false)}
            />
          </div>
        )}

        {loading ? (
          <div className="flex gap-4 px-6 overflow-hidden flex-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-3 flex-1 min-w-[200px]">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
        ) : !data || data.shoots.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
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
          <div className="flex-1 overflow-x-auto pb-4">
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

function ShootCard({
  shoot,
  onStatusChange,
  onDelete,
  onUpdateSent,
  onDetail,
}: {
  shoot: PhotoShoot;
  onStatusChange: (status: PhotoShootStatus) => void;
  onDelete: () => void;
  onUpdateSent: (galleryLink: string, photosSent: number) => void;
  onDetail: () => void;
}) {
  const [sentLink, setSentLink] = useState(shoot.galleryLink ?? "");
  const [sentCount, setSentCount] = useState(shoot.photosSent ?? 0);
  const [showSentForm, setShowSentForm] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSentLink(shoot.galleryLink ?? "");
    setSentCount(shoot.photosSent ?? 0);
  }, [shoot]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const nextStatus: PhotoShootStatus | null = (() => {
    const idx = statusIndex(shoot.status);
    return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
  })();

  const handleSend = () => {
    if (sentLink.trim()) {
      onUpdateSent(sentLink.trim(), sentCount);
      setShowSentForm(false);
    }
  };

  return (
    <div
      className="group border border-[var(--border-1)] rounded-lg bg-[var(--surface)] hover:border-[var(--border-3)] transition-colors duration-150 cursor-grab active:cursor-grabbing"
    >
      <div className="p-3 space-y-2" onClick={onDetail}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <GripVertical
              className="w-3 h-3 text-[var(--text-4)] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
              onMouseDown={(e) => e.stopPropagation()}
            />
            <h4 className="text-[13px] font-medium text-[var(--text-1)] truncate">{shoot.title}</h4>
          </div>
          <Pill tone={STATUS_PILL_TONE[shoot.status]}>{STATUS_FLOW[statusIndex(shoot.status)].label}</Pill>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--text-3)] font-mono">
          <span>{formatDate(shoot.date)}</span>
          <span>{shoot.client}</span>
        </div>

        {shoot.status === "sent" && shoot.galleryLink && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--accent)] font-mono">
            <span>{shoot.photosSent ?? "?"} photos</span>
            <a href={shoot.galleryLink} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline inline-flex items-center gap-1">
              Galerie <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        )}

        {shoot.notes && (
          <p className="text-[12px] text-[var(--text-3)] leading-relaxed line-clamp-2">{shoot.notes}</p>
        )}
      </div>

      {shoot.status === "sent" && (
        <div className="px-3 pb-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="url"
            value={sentLink}
            onChange={(e) => setSentLink(e.target.value)}
            placeholder="Lien galerie"
            className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-2 py-1.5 text-[12px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={sentCount}
              onChange={(e) => setSentCount(Number(e.target.value))}
              min={0}
              placeholder="Nb photos"
              className="w-20 bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-2 py-1.5 text-[12px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
            />
            <Button variant="primary" size="sm" onClick={handleSend} disabled={!sentLink.trim()}>
              {shoot.galleryLink ? "Mettre à jour" : "Valider"}
            </Button>
          </div>
        </div>
      )}

      {showSentForm && shoot.status !== "sent" && (
        <div className="px-3 pb-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="url"
            value={sentLink}
            onChange={(e) => setSentLink(e.target.value)}
            placeholder="Lien galerie"
            className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-2 py-1.5 text-[12px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={sentCount}
              onChange={(e) => setSentCount(Number(e.target.value))}
              min={0}
              placeholder="Nb photos"
              className="w-20 bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-2 py-1.5 text-[12px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
            />
            <Button variant="primary" size="sm" onClick={handleSend} disabled={!sentLink.trim()}>
              Envoyer
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-3 pb-3 border-t border-[var(--border-1)] pt-2">
        <div className="flex items-center gap-1">
          {nextStatus && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (nextStatus === "sent") {
                  setShowSentForm(true);
                } else {
                  onStatusChange(nextStatus);
                }
              }}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider">{STATUS_FLOW.find((s) => s.key === nextStatus)?.label}</span>
            </Button>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-4)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ---------- DetailModal ---------- */

function DetailModal({
  shoot,
  onClose,
  onEdit,
  onDelete,
}: {
  shoot: PhotoShoot;
  onClose: () => void;
  onEdit: (updates: Partial<{ title: string; date: string; client: string; notes: string; galleryLink: string; photosSent: number }>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(shoot.title);
  const [editDate, setEditDate] = useState(shoot.date);
  const [editClient, setEditClient] = useState(shoot.client);
  const [editNotes, setEditNotes] = useState(shoot.notes ?? "");
  const [editGalleryLink, setEditGalleryLink] = useState(shoot.galleryLink ?? "");
  const [editPhotosSent, setEditPhotosSent] = useState(shoot.photosSent ?? 0);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setEditTitle(shoot.title);
    setEditDate(shoot.date);
    setEditClient(shoot.client);
    setEditNotes(shoot.notes ?? "");
    setEditGalleryLink(shoot.galleryLink ?? "");
    setEditPhotosSent(shoot.photosSent ?? 0);
    setEditing(false);
  }, [shoot]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = () => {
    const updates: Partial<{ title: string; date: string; client: string; notes: string; galleryLink: string; photosSent: number }> = {};
    if (editTitle.trim() && editTitle.trim() !== shoot.title) updates.title = editTitle.trim();
    if (editDate.trim() !== shoot.date) updates.date = editDate.trim();
    if (editClient.trim() && editClient.trim() !== shoot.client) updates.client = editClient.trim();
    if (editNotes.trim() !== (shoot.notes ?? "")) updates.notes = editNotes.trim() || "";
    if (editGalleryLink.trim() !== (shoot.galleryLink ?? "")) updates.galleryLink = editGalleryLink.trim();
    if (editPhotosSent !== (shoot.photosSent ?? 0)) updates.photosSent = editPhotosSent;
    if (Object.keys(updates).length > 0) onEdit(updates);
    setEditing(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000]/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 border border-[var(--border-1)] rounded-lg bg-[var(--surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-1)]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATUS_FLOW[statusIndex(shoot.status)].color }} />
            <h2 className="text-[15px] font-semibold text-[var(--text-1)]">{shoot.title}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4 text-[12px] font-mono text-[var(--text-2)]">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-4)] uppercase tracking-wider">Date</span>
              <span>{formatDate(shoot.date)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-4)] uppercase tracking-wider">Client</span>
              <span>{shoot.client}</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <Pill tone={STATUS_PILL_TONE[shoot.status]}>{STATUS_FLOW[statusIndex(shoot.status)].label}</Pill>
            </div>
          </div>

          {shoot.status === "sent" && shoot.galleryLink && (
            <div className="flex items-center gap-3 text-[12px] font-mono text-[var(--accent)] p-3 border border-[var(--border-1)] rounded-md bg-[var(--surface-2)]">
              <span>{shoot.photosSent ?? "?"} photos envoyées</span>
              <a href={shoot.galleryLink} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline inline-flex items-center gap-1">
                Voir la galerie <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
                placeholder="Titre"
              />
              <div className="flex gap-3">
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="flex-1 bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
                />
                <input
                  type="text"
                  value={editClient}
                  onChange={(e) => setEditClient(e.target.value)}
                  className="flex-1 bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
                  placeholder="Client"
                />
              </div>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50 resize-none"
                placeholder="Notes"
              />
              {shoot.status === "sent" && (
                <div className="space-y-3 pt-1">
                  <input
                    type="url"
                    value={editGalleryLink}
                    onChange={(e) => setEditGalleryLink(e.target.value)}
                    placeholder="Lien galerie"
                    className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
                  />
                  <input
                    type="number"
                    value={editPhotosSent}
                    onChange={(e) => setEditPhotosSent(Number(e.target.value))}
                    min={0}
                    placeholder="Nombre de photos"
                    className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
                  />
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
                <Button variant="primary" size="sm" onClick={handleSave}>Sauvegarder</Button>
              </div>
            </div>
          ) : (
            <>
              {shoot.notes && (
                <div>
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-4)] mb-1.5">Notes</h4>
                  <p className="text-[13px] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">{shoot.notes}</p>
                </div>
              )}
              {!shoot.notes && (
                <p className="text-[13px] text-[var(--text-4)] italic">Aucune note</p>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-1)]">
                <Button variant="danger" size="sm" onClick={onDelete}>
                  Supprimer
                </Button>
                <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                  Éditer
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- AddShootForm ---------- */

function AddShootForm({
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
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre du shooting"
        className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
        />
        <input
          type="text"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          placeholder="Client"
          className="bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
        />
      </div>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optionnel)"
        className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
      />
      <div className="flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!title.trim() || !date.trim() || !client.trim()} leftIcon={<Plus className="w-3 h-3" />}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
