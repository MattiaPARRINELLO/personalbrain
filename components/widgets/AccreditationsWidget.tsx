"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { FileBadge, ArrowRight, CalendarDays } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { loadAccreditations } from "@/app/actions/accreditations";
import type { Accreditation } from "@/lib/types";

const statusMeta: Record<Accreditation["status"], { label: string; tone: "muted" | "accent" | "success" | "danger" | "warm" }> = {
  pending: { label: "En attente", tone: "muted" },
  sent: { label: "Envoyée", tone: "accent" },
  accepted: { label: "Acceptée", tone: "success" },
  refused: { label: "Refusée", tone: "danger" },
  "follow-up": { label: "Relance", tone: "warm" },
};

export function AccreditationsWidget() {
  const [upcoming, setUpcoming] = useState<Accreditation[]>([]);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    Promise.resolve().then(() => {
      startTransition(async () => {
        try {
          const data = await loadAccreditations();
          const active = data.accreditations
            .filter((a) => a.status !== "accepted" && a.status !== "refused")
            .sort((a, b) => new Date(a.concertDate).getTime() - new Date(b.concertDate).getTime())
            .slice(0, 3);
          setUpcoming(active);
        } finally {
          setLoading(false);
        }
      });
    });
  }, []);

  return (
    <Card>
      <CardHeader
        title="Accréditations"
        action={
          <Link
            href="/accreditations"
            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
            title="Voir toutes les accréditations"
          >
            <ArrowRight className="w-3 h-3" />
          </Link>
        }
      />
      <CardBody className="p-3 space-y-2">
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-[var(--surface-2)] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && upcoming.length === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <FileBadge className="w-5 h-5 text-[var(--text-4)] mb-2" />
            <p className="text-[11px] text-[var(--text-3)]">Aucune accréditation en cours</p>
          </div>
        )}

        {!loading &&
          upcoming.map((acc) => {
            const meta = statusMeta[acc.status];
            return (
              <Link
                key={acc.id}
                href="/accreditations"
                className="block p-2.5 rounded-lg border border-[var(--border-1)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]/50 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[var(--text-1)] truncate">{acc.artist}</p>
                    <p className="text-[10px] text-[var(--text-3)] mt-0.5 truncate">{acc.venue}</p>
                  </div>
                  <Pill tone={meta.tone}>{meta.label}</Pill>
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-[var(--text-3)]">
                  <CalendarDays className="w-2.5 h-2.5" />
                  <span>{formatDate(acc.concertDate)}</span>
                </div>
              </Link>
            );
          })}
      </CardBody>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}
