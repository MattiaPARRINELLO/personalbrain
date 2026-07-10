"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Camera, ArrowRight, Image } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { loadPhotoShoots } from "@/app/actions/photography";
import type { PhotoShoot, PhotoShootStatus } from "@/lib/types";

const STATUS_FLOW: Record<PhotoShootStatus, { label: string; tone: "neutral" | "accent" | "warm" | "success" | "danger" | "muted" }> = {
  upcoming: { label: "À venir", tone: "neutral" },
  done: { label: "Fait", tone: "accent" },
  on_pc: { label: "Sur PC", tone: "accent" },
  sorted: { label: "Trié", tone: "warm" },
  edited: { label: "Retouché", tone: "accent" },
  exported: { label: "Exporté", tone: "warm" },
  sent: { label: "Envoyé", tone: "success" },
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

export function AccreditationsWidget() {
  const [data, setData] = useState<PhotoShoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const d = await loadPhotoShoots();
        setData(d.shoots);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const upcoming = data
    .filter((s) => s.status !== "sent")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  return (
    <Card>
      <CardHeader
        title="Suivi Photos"
        action={
          <Link
            href="/photos"
            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
            title="Voir tous les shootings"
          >
            <ArrowRight className="w-3 h-3" />
          </Link>
        }
      />
      <CardBody>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-[var(--surface-2)] animate-pulse" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Camera className="w-8 h-8 text-[var(--text-4)] mb-2" />
            <p className="text-[12px] text-[var(--text-3)]">Aucun shooting en cours</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {upcoming.map((shoot) => {
              const meta = STATUS_FLOW[shoot.status];
              return (
                <Link
                  key={shoot.id}
                  href="/photos"
                  className="block p-2.5 rounded-lg border border-[var(--border-1)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]/50 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-[var(--text-1)] truncate">{shoot.title}</p>
                      <p className="text-[10px] text-[var(--text-3)] mt-0.5 truncate">{shoot.client}</p>
                    </div>
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[var(--text-3)]">
                    <span>{formatDate(shoot.date)}</span>
                    {shoot.photosSent != null && (
                      <span className="flex items-center gap-1">
                        <Image className="w-2.5 h-2.5" />
                        {shoot.photosSent}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
