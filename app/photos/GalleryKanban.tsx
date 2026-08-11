"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/layout/Chrome";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Camera, Check, Pencil, Send, CalendarClock, ArrowRight } from "lucide-react";
import type { GalleryItem, GalleryStatus } from "@/lib/types";

const STATUS_LABELS: Record<GalleryStatus, string> = {
  shooted: "Shooted",
  selecting: "Selecting",
  editing: "Editing",
  delivered: "Delivered",
};

const STATUS_COLORS: Record<GalleryStatus, "neutral" | "accent" | "warm" | "success"> = {
  shooted: "neutral",
  selecting: "accent",
  editing: "warm",
  delivered: "success",
};

// Kanban de livraison (gallery.json), intégré à la page Photos : une seule
// entrée « Photos » dans la navigation, deux vues (Shootings / Livraison).
export function GalleryKanban() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGalleryItems().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6 pb-6">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
      </div>
    );
  }

  const columns: GalleryStatus[] = ["shooted", "selecting", "editing", "delivered"];

  if (items.length === 0) {
    return (
      <div className="px-6 pb-6">
        <EmptyState title="Galerie vide" description="Aucune galerie de livraison pour le moment. Les concerts shootés apparaîtront ici." />
      </div>
    );
  }

  return (
    <div className="px-6 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((status) => (
          <div key={status}>
            <div className="flex items-center gap-2 mb-3">
              <Pill tone={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Pill>
              <span className="text-xs text-[var(--text-4)]">
                {items.filter((g) => g.status === status).length}
              </span>
            </div>
            <div className="space-y-3">
              {items
                .filter((g) => g.status === status)
                .map((g) => (
                  <Card key={g.id} className="p-4 space-y-2.5">
                    <div className="text-sm font-medium text-[var(--text-1)]">{g.title}</div>
                    <div className="text-xs text-[var(--text-3)] space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Camera className="w-3 h-3 text-[var(--text-4)]" />
                        {g.totalPhotos} photos
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-[var(--accent-success)]" />
                        {g.selectedPhotos} sélectionnées
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Pencil className="w-3 h-3 text-[var(--text-4)]" />
                        {g.editedPhotos} éditées
                      </div>
                      {g.deliveredTo && (
                        <div className="flex items-center gap-1.5">
                          <Send className="w-3 h-3 text-[var(--text-4)]" />
                          Envoyé à : {g.deliveredTo}
                        </div>
                      )}
                      {g.deadline && (
                        <div className={new Date(g.deadline) < new Date() ? "flex items-center gap-1.5 text-[var(--danger)]" : "flex items-center gap-1.5"}>
                          <CalendarClock className="w-3 h-3 text-[var(--text-4)]" />
                          Deadline : {new Date(g.deadline).toLocaleDateString("fr-FR")}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      {status !== "delivered" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => moveItem(g.id, status, columns[columns.indexOf(status) + 1])}
                          rightIcon={<ArrowRight className="w-3 h-3" />}
                        >
                          Avancer
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function loadGalleryItems(): Promise<GalleryItem[]> {
  const res = await fetch("/api/gallery");
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

async function moveItem(id: string, from: GalleryStatus, to: GalleryStatus) {
  await fetch("/api/gallery", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status: to }),
  });
  window.location.reload();
}
