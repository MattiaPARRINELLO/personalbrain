"use client";

import { useState, useEffect } from "react";
import { X, GripVertical, ExternalLink } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";
import type { PhotoShoot, PhotoShootStatus } from "@/lib/types";
import { STATUS_FLOW, STATUS_ORDER, STATUS_PILL_TONE, statusIndex, formatDate } from "./constants";

export function ShootCard({
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
      className="group border border-[var(--border-1)] rounded-lg bg-[var(--surface-1)] hover:border-[var(--border-3)] transition-colors duration-150 cursor-grab active:cursor-grabbing"
    >
      <div className="p-3 space-y-2" onClick={onDetail}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <GripVertical
              className="hidden sm:block w-3 h-3 text-[var(--text-4)] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
              onMouseDown={(e) => e.stopPropagation()}
            />
            <h4 className="text-[13px] font-medium text-[var(--text-1)] truncate">{shoot.title}</h4>
          </div>
          <Pill tone={STATUS_PILL_TONE[shoot.status]}>{STATUS_FLOW[statusIndex(shoot.status)].label}</Pill>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--text-3)] font-mono flex-wrap">
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
          <Input
            type="url"
            value={sentLink}
            onChange={(e) => setSentLink(e.target.value)}
            placeholder="Lien galerie"
            className="px-2 py-1.5 text-[12px]"
          />
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={sentCount}
              onChange={(e) => setSentCount(Number(e.target.value))}
              min={0}
              placeholder="Nb photos"
              className="w-20 px-2 py-1.5 text-[12px]"
            />
            <Button variant="primary" size="sm" onClick={handleSend} disabled={!sentLink.trim()}>
              {shoot.galleryLink ? "Mettre à jour" : "Valider"}
            </Button>
          </div>
        </div>
      )}

      {showSentForm && shoot.status !== "sent" && (
        <div className="px-3 pb-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          <Input
            type="url"
            value={sentLink}
            onChange={(e) => setSentLink(e.target.value)}
            placeholder="Lien galerie"
            className="px-2 py-1.5 text-[12px]"
          />
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={sentCount}
              onChange={(e) => setSentCount(Number(e.target.value))}
              min={0}
              placeholder="Nb photos"
              className="w-20 px-2 py-1.5 text-[12px]"
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
        <IconButton
          label="Supprimer"
          size="xs"
          tone="danger"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-[var(--text-4)] hover:text-[var(--danger)]"
        >
          <X className="w-3 h-3" />
        </IconButton>
      </div>
    </div>
  );
}
