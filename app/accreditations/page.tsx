"use client";

import { useState, useTransition, useEffect, useMemo, useCallback } from "react";
import {
  Plus, X, Search, Mail, ChevronDown, RefreshCw, Send, FileText,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  loadAccreditations, createAccreditation, editAccreditation, removeAccreditation,
  scanAccreditationsAction, generateFollowUpDraft,
} from "@/app/actions/accreditations";
import type { Accreditation, AccreditationsData } from "@/lib/types";
import { cn } from "@/lib/utils";

type AccStatus = Accreditation["status"];

const KANBAN_COLUMNS: { key: AccStatus; label: string; color: string }[] = [
  { key: "sent", label: "ENVOYÉ", color: "var(--accent)" },
  { key: "pending", label: "EN ATTENTE", color: "var(--text-3)" },
  { key: "accepted", label: "ACCEPTÉ", color: "var(--success)" },
  { key: "refused", label: "REFUSÉ", color: "var(--danger)" },
  { key: "follow-up", label: "RELANCE", color: "var(--warm)" },
];

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

export default function AccreditationsPage() {
  const [data, setData] = useState<AccreditationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState<{ id: string; draft: string } | null>(null);
  const [dragSource, setDragSource] = useState<{ id: string; from: AccStatus } | null>(null);
  const { show: showToast } = useToast();

  useEffect(() => {
    Promise.resolve().then(() => {
      startTransition(async () => {
        try {
          const d = await loadAccreditations();
          setData(d);
        } finally {
          setLoading(false);
        }
      });
    });
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scanAccreditationsAction();
      const d = await loadAccreditations();
      setData(d);
      showToast({ message: result.message, tone: "success" });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Erreur lors du scan", tone: "danger" });
    } finally {
      setScanning(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: AccStatus) => {
    startTransition(async () => {
      const updated = await editAccreditation(id, { status: newStatus });
      if (updated && data) {
        setData({
          accreditations: data.accreditations.map((a) => (a.id === id ? updated : a)),
        });
      }
    });
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      await removeAccreditation(id);
      if (data) {
        setData({ accreditations: data.accreditations.filter((a) => a.id !== id) });
      }
    });
  };

  const handleAdd = async (input: {
    artist: string; venue: string; concertDate: string;
    contactEmail?: string; notes?: string;
  }) => {
    startTransition(async () => {
      try {
        const acc = await createAccreditation(input);
        if (data) setData({ accreditations: [acc, ...data.accreditations] });
        setShowAdd(false);
      } catch {}
    });
  };

  const handleGenerateFollowUp = async (id: string) => {
    try {
      const draft = await generateFollowUpDraft(id);
      setFollowUpDraft({ id, draft });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Erreur", tone: "danger" });
    }
  };

  const handleDragStart = (id: string, from: AccStatus) => {
    setDragSource({ id, from });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (to: AccStatus) => {
    if (!dragSource || dragSource.from === to) return;
    await handleStatusChange(dragSource.id, to);
    setDragSource(null);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!searchQuery.trim()) return data.accreditations;
    const q = searchQuery.toLowerCase();
    return data.accreditations.filter(
      (a) =>
        a.artist.toLowerCase().includes(q) ||
        a.venue.toLowerCase().includes(q) ||
        a.concertDate.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  const columns = useMemo(() => {
    const grouped: Record<AccStatus, Accreditation[]> = {
      pending: [], sent: [], accepted: [], refused: [], "follow-up": [],
    };
    for (const acc of filtered) {
      if (grouped[acc.status]) grouped[acc.status].push(acc);
    }
    return grouped;
  }, [filtered]);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader
          title="Accréditations"
          description="Suivi des demandes d'accréditation photo"
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-4)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrer par artiste, lieu, date…"
                  className="w-56 bg-[var(--surface-2)] border border-[var(--border-2)] rounded-md pl-8 pr-3 py-1.5 text-[12px] text-[var(--text-1)] placeholder:text-[var(--text-4)] outline-none focus:border-[var(--accent)]/40"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={handleScan} loading={scanning} leftIcon={<RefreshCw className="w-3 h-3" />}>
                Scanner les accréditations
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)} leftIcon={<Plus className="w-3 h-3" />}>
                Ajouter
              </Button>
            </div>
          }
        />

        {showAdd && (
          <div className="mb-6">
            <AddAccreditationForm onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />
          </div>
        )}

        {/* Follow-up draft modal */}
        {followUpDraft && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setFollowUpDraft(null)}>
            <div className="bg-[var(--surface-2)] border border-[var(--border-1)] rounded-xl max-w-lg w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-[var(--text-1)]">Brouillon de relance</h3>
                <button onClick={() => setFollowUpDraft(null)} className="text-[var(--text-4)] hover:text-[var(--text-1)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={followUpDraft.draft}
                onChange={(e) => setFollowUpDraft({ ...followUpDraft, draft: e.target.value })}
                rows={8}
                className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md p-3 text-[13px] text-[var(--text-1)] outline-none resize-none"
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setFollowUpDraft(null)}>
                  Annuler
                </Button>
                <Button variant="primary" size="sm" leftIcon={<Send className="w-3 h-3" />}>
                  Envoyer
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : !data || data.accreditations.length === 0 ? (
          <EmptyState
            icon={<Mail className="w-8 h-8" />}
            title="Aucune accréditation"
            description="Ajoute une demande ou scanne tes emails pour importer les accréditations automatiquement."
            action={
              <Button variant="primary" size="sm" onClick={() => setShowAdd(true)} leftIcon={<Plus className="w-3 h-3" />}>
                Ajouter une accréditation
              </Button>
            }
          />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
            {KANBAN_COLUMNS.map((col) => {
              const items = columns[col.key];
              return (
                <div
                  key={col.key}
                  className="flex-1 min-w-[220px] bg-[var(--surface-2)]/50 rounded-xl border border-[var(--border-2)] p-3"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(col.key)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: col.color }}
                      />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-3)]">
                        {col.label}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--text-4)] bg-[var(--surface-1)] px-1.5 py-0.5 rounded">
                      {items.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <div className="text-[11px] text-[var(--text-4)] text-center py-6 font-mono">
                        Vide
                      </div>
                    ) : (
                      items.map((acc) => (
                        <KanbanCard
                          key={acc.id}
                          accreditation={acc}
                          onDragStart={() => handleDragStart(acc.id, acc.status)}
                          onStatusChange={(s) => handleStatusChange(acc.id, s)}
                          onDelete={() => handleDelete(acc.id)}
                          onGenerateFollowUp={() => handleGenerateFollowUp(acc.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ─── Kanban Card ─── */

function KanbanCard({
  accreditation,
  onDragStart,
  onStatusChange,
  onDelete,
  onGenerateFollowUp,
}: {
  accreditation: Accreditation;
  onDragStart: () => void;
  onStatusChange: (s: AccStatus) => void;
  onDelete: () => void;
  onGenerateFollowUp: () => void;
}) {
  const days = daysSince(accreditation.updatedAt);
  const needsFollowUp = (accreditation.status === "sent" || accreditation.status === "pending") && days > 3;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-3 space-y-2 cursor-grab active:cursor-grabbing hover:border-[var(--accent)]/30 transition-colors"
    >
      {needsFollowUp && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--warm)]/10 border border-[var(--warm)]/20">
          <span className="text-[10px] text-[var(--warm)] font-mono">
            Sans réponse depuis {days} jours
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text-1)] truncate">
            {accreditation.artist}
          </p>
          <p className="text-[11px] text-[var(--text-3)] truncate">
            {accreditation.venue}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[var(--text-4)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <p className="text-[10px] font-mono text-[var(--text-4)]">
        {formatDate(accreditation.concertDate)}
      </p>

      {accreditation.contactEmail && (
        <p className="text-[10px] text-[var(--text-4)] truncate">{accreditation.contactEmail}</p>
      )}

      <div className="flex items-center gap-1 pt-1">
        <select
          value={accreditation.status}
          onChange={(e) => onStatusChange(e.target.value as AccStatus)}
          className="flex-1 bg-[var(--surface-2)] border border-[var(--border-2)] rounded px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-1)] outline-none cursor-pointer"
        >
          <option value="pending">En attente</option>
          <option value="sent">Envoyé</option>
          <option value="accepted">Accepté</option>
          <option value="refused">Refusé</option>
          <option value="follow-up">Relance</option>
        </select>

        {needsFollowUp && (
          <button
            onClick={onGenerateFollowUp}
            className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--warm)]/10 text-[var(--warm)] border border-[var(--warm)]/20 hover:bg-[var(--warm)]/20 transition-colors"
          >
            Rédiger une relance
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Formulaire d'ajout ─── */

function AddAccreditationForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: {
    artist: string; venue: string; concertDate: string;
    contactEmail?: string; notes?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [artist, setArtist] = useState("");
  const [venue, setVenue] = useState("");
  const [concertDate, setConcertDate] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    onSubmit({
      artist: artist.trim(),
      venue: venue.trim(),
      concertDate: concertDate.trim(),
      contactEmail: contactEmail.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setArtist("");
    setVenue("");
    setConcertDate("");
    setContactEmail("");
    setNotes("");
  };

  return (
    <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <input
          type="text"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artiste"
          className="bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
        />
        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Lieu"
          className="bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
        />
        <input
          type="date"
          value={concertDate}
          onChange={(e) => setConcertDate(e.target.value)}
          className="bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="Email de contact (optionnel)"
          className="bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optionnel)"
          className="bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
        />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!artist.trim() || !venue.trim() || !concertDate.trim()} leftIcon={<Plus className="w-3 h-3" />}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}

/* ─── Utilitaires ─── */

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
    return d.toLocaleDateString("fr-FR", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
