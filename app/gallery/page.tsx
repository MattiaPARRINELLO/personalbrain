"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
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

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGalleryItems().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  const columns: GalleryStatus[] = ["shooted", "selecting", "editing", "delivered"];

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <PageHeader title="Galeries" description="Suis le pipeline de livraison de tes photos." />

        {items.length === 0 ? (
          <EmptyState title="Galerie vide" description="Aucune galerie pour le moment. Les concerts shootés apparaîtront ici." />
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {columns.map((status) => (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <Pill tone={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Pill>
                  <span className="text-xs text-[var(--muted)]">
                    {items.filter((g) => g.status === status).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {items
                    .filter((g) => g.status === status)
                    .map((g) => (
                      <Card key={g.id} className="p-4 space-y-2">
                        <div className="text-sm font-medium text-[var(--fg)]">{g.title}</div>
                        <div className="text-xs text-[var(--muted)] space-y-1">
                          <div>📸 {g.totalPhotos} photos</div>
                          <div>✓ {g.selectedPhotos} sélectionnées</div>
                          <div>✏️ {g.editedPhotos} éditées</div>
                          {g.deliveredTo && <div>📤 Envoyé à : {g.deliveredTo}</div>}
                          {g.deadline && (
                            <div className={new Date(g.deadline) < new Date() ? "text-red-400" : ""}>
                              📅 Deadline : {new Date(g.deadline).toLocaleDateString("fr-FR")}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-2">
                          {status !== "delivered" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => moveItem(g.id, status, columns[columns.indexOf(status) + 1])}
                            >
                              Avancer →
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
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
