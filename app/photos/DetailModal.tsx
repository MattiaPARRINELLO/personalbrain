"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type { PhotoShoot } from "@/lib/types";
import { STATUS_FLOW, STATUS_PILL_TONE, statusIndex, formatDate } from "./constants";

export type ShootEditableFields = {
  title: string;
  date: string;
  client: string;
  notes: string;
  galleryLink: string;
  photosSent: number;
};

export function DetailModal({
  shoot,
  onClose,
  onEdit,
  onDelete,
}: {
  shoot: PhotoShoot;
  onClose: () => void;
  onEdit: (updates: Partial<ShootEditableFields>) => void;
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
    const updates: Partial<ShootEditableFields> = {};
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)]/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 border border-[var(--border-1)] rounded-lg bg-[var(--surface-1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-1)]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: STATUS_FLOW[statusIndex(shoot.status)].color }} />
            <h2 className="text-[15px] font-semibold text-[var(--text-1)] truncate">{shoot.title}</h2>
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
                Voir la galerie <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              <Input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Titre"
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full sm:flex-1"
                />
                <Input
                  type="text"
                  value={editClient}
                  onChange={(e) => setEditClient(e.target.value)}
                  className="w-full sm:flex-1"
                  placeholder="Client"
                />
              </div>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Notes"
              />
              {shoot.status === "sent" && (
                <div className="space-y-3 pt-1">
                  <Input
                    type="url"
                    value={editGalleryLink}
                    onChange={(e) => setEditGalleryLink(e.target.value)}
                    placeholder="Lien galerie"
                  />
                  <Input
                    type="number"
                    value={editPhotosSent}
                    onChange={(e) => setEditPhotosSent(Number(e.target.value))}
                    min={0}
                    placeholder="Nombre de photos"
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
