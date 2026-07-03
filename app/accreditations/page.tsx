"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  Search,
  FileBadge,
  X,
  CalendarDays,
  Building2,
  Mail,
  ChevronDown,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { loadAccreditations, createAccreditation, editAccreditation, removeAccreditation } from "@/app/actions/accreditations";
import type { Accreditation, AccreditationsData } from "@/lib/types";

type AccStatus = Accreditation["status"];

const statusMeta: Record<AccStatus, { label: string; tone: "muted" | "accent" | "success" | "danger" | "warm" }> = {
  pending: { label: "En attente", tone: "muted" },
  sent: { label: "Envoyée", tone: "accent" },
  accepted: { label: "Acceptée", tone: "success" },
  refused: { label: "Refusée", tone: "danger" },
  "follow-up": { label: "Relance", tone: "warm" },
};

export default function AccreditationsPage() {
  const [data, setData] = useState<AccreditationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      const ok = await removeAccreditation(id);
      if (ok && data) {
        setData({ accreditations: data.accreditations.filter((a) => a.id !== id) });
      }
    });
  };

  const handleStatusChange = async (id: string, newStatus: AccStatus) => {
    startTransition(async () => {
      const updated = await editAccreditation(id, { status: newStatus });
      if (updated && data) {
        setData({
          accreditations: data.accreditations.map((a) => (a.id === id ? updated : a)),
        });
      }
      setEditingStatus(null);
    });
  };

  const handleAdd = async (input: {
    artist: string;
    venue: string;
    concertDate: string;
    contactEmail?: string;
    notes?: string;
  }) => {
    startTransition(async () => {
      try {
        const acc = await createAccreditation(input);
        if (data) {
          setData({ accreditations: [acc, ...data.accreditations] });
        }
        setShowAdd(false);
      } catch {
        // Rien — les validations sont côté serveur
      }
    });
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!searchQuery.trim()) return data.accreditations;
    const q = searchQuery.toLowerCase();
    return data.accreditations.filter(
      (a) =>
        a.artist.toLowerCase().includes(q) ||
        a.venue.toLowerCase().includes(q) ||
        (a.notes && a.notes.toLowerCase().includes(q)) ||
        (a.contactEmail && a.contactEmail.toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Photographie de concerts"
            title="Accréditations"
            description="Suis tes demandes d'accréditation photo pour les concerts. Ajoute, modifie le statut ou supprime une demande."
            actions={
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowAdd((s) => !s)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Nouvelle demande
              </Button>
            }
          />

          {showAdd && (
            <AddAccreditationForm
              onCancel={() => setShowAdd(false)}
              onSubmit={handleAdd}
            />
          )}

          {/* Barre de recherche */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-3)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par artiste, lieu, notes…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)]/60 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50 transition-colors"
            />
          </div>

          {/* Loading */}
          {loading && !data && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {data && filtered.length === 0 && (
            <EmptyState
              icon={<FileBadge className="w-5 h-5" />}
              title={searchQuery ? "Aucun résultat" : "Aucune accréditation"}
              description={
                searchQuery
                  ? "Essaie un autre terme de recherche."
                  : "Tu n'as pas encore de demandes d'accréditation. Ajoutes-en une !"
              }
              action={
                !searchQuery ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowAdd(true)}
                    leftIcon={<Plus className="w-3 h-3" />}
                  >
                    Première demande
                  </Button>
                ) : undefined
              }
            />
          )}

          {/* Liste */}
          {data && filtered.length > 0 && (
            <div className="space-y-1.5">
              {filtered.map((acc) => (
                <AccreditationRow
                  key={acc.id}
                  accreditation={acc}
                  editingStatus={editingStatus === acc.id}
                  onStartEditStatus={() => setEditingStatus(acc.id)}
                  onStatusChange={(s) => handleStatusChange(acc.id, s)}
                  onDelete={() => handleDelete(acc.id)}
                  onCloseEdit={() => setEditingStatus(null)}
                />
              ))}
            </div>
          )}

          {/* Compteur */}
          {data && filtered.length > 0 && (
            <p className="mt-4 text-[10px] text-[var(--text-4)] font-mono text-center">
              {filtered.length} / {data.accreditations.length} accréditation{data.accreditations.length > 1 ? "s" : ""}
              {searchQuery && " (filtrée" + (filtered.length > 1 ? "s" : "") + ")"}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ─── Ligne d'accréditation ─── */

function AccreditationRow({
  accreditation,
  editingStatus,
  onStartEditStatus,
  onStatusChange,
  onDelete,
  onCloseEdit,
}: {
  accreditation: Accreditation;
  editingStatus: boolean;
  onStartEditStatus: () => void;
  onStatusChange: (s: AccStatus) => void;
  onDelete: () => void;
  onCloseEdit: () => void;
}) {
  const meta = statusMeta[accreditation.status];

  return (
    <div className="group flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]/50 transition-all duration-200">
      {/* Barre latérale de statut */}
      <span
        className={`shrink-0 w-1 self-stretch rounded-full ${
          accreditation.status === "pending"
            ? "bg-[var(--text-4)]"
            : accreditation.status === "sent"
              ? "bg-[var(--accent)]"
              : accreditation.status === "accepted"
                ? "bg-[var(--success)]"
                : accreditation.status === "refused"
                  ? "bg-[var(--danger)]"
                  : "bg-[var(--warm)]"
        }`}
      />

      {/* Infos principales */}
      <div className="flex-1 min-w-0 grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-2 sm:gap-4">
        {/* Artiste */}
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-[var(--text-1)] truncate">{accreditation.artist}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1 text-[11px] text-[var(--text-3)]">
              <Building2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{accreditation.venue}</span>
            </span>
          </div>
        </div>

        {/* Date */}
        <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-[var(--text-2)]">
          <CalendarDays className="w-3 h-3 shrink-0" />
          <span>{formatDate(accreditation.concertDate)}</span>
        </div>

        {/* Contact */}
        {accreditation.contactEmail && (
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[var(--text-3)] min-w-0">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{accreditation.contactEmail}</span>
          </div>
        )}

        {/* Statut */}
        <div className="flex items-center justify-end gap-2">
          {editingStatus ? (
            <StatusPicker current={accreditation.status} onSelect={onStatusChange} onClose={onCloseEdit} />
          ) : (
            <button
              onClick={onStartEditStatus}
              className="group/status relative"
              title="Changer le statut"
            >
              <Pill tone={meta.tone} dot>
                {meta.label}
              </Pill>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[var(--surface-2)] border border-[var(--border-1)] flex items-center justify-center opacity-0 group-hover/status:opacity-100 transition-opacity">
                <ChevronDown className="w-2 h-2 text-[var(--text-3)]" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
          title="Supprimer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ─── Sélecteur de statut inline ─── */

const statusList: AccStatus[] = ["pending", "sent", "accepted", "refused", "follow-up"];

function StatusPicker({
  current,
  onSelect,
  onClose,
}: {
  current: AccStatus;
  onSelect: (s: AccStatus) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)]">
      {statusList.map((s) => {
        const meta = statusMeta[s];
        const active = s === current;
        return (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all duration-200 ${
              active
                ? "bg-[var(--surface-3)] shadow-sm border border-[var(--border-1)]"
                : "text-[var(--text-3)] hover:text-[var(--text-1)] border border-transparent"
            }`}
            style={
              active
                ? {
                    color: `var(--${
                      s === "pending" ? "text-1" : s === "sent" ? "accent" : s === "accepted" ? "success" : s === "refused" ? "danger" : "warm"
                    })`,
                  }
                : undefined
            }
          >
            {meta.label}
          </button>
        );
      })}
      <button
        onClick={onClose}
        className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-4)] hover:text-[var(--text-1)]"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

/* ─── Formulaire d'ajout ─── */

function AddAccreditationForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (input: { artist: string; venue: string; concertDate: string; contactEmail?: string; notes?: string }) => void;
}) {
  const [artist, setArtist] = useState("");
  const [venue, setVenue] = useState("");
  const [concertDate, setConcertDate] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!artist.trim() || !venue.trim() || !concertDate.trim()) {
      setError("Artiste, lieu et date sont requis.");
      return;
    }
    setError("");
    onSubmit({
      artist: artist.trim(),
      venue: venue.trim(),
      concertDate,
      contactEmail: contactEmail.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="mb-6 p-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 fade-in">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] font-mono mb-3">
        Nouvelle demande d&apos;accréditation
      </p>

      {error && (
        <p className="text-[11px] text-[var(--danger)] mb-3 font-medium">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1">
            Artiste
          </label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Muse, Justice…"
            className="w-full h-8 px-3 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1">
            Lieu
          </label>
          <input
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Accor Arena, Olympia…"
            className="w-full h-8 px-3 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1">
            Date du concert
          </label>
          <input
            type="date"
            value={concertDate}
            onChange={(e) => setConcertDate(e.target.value)}
            className="w-full h-8 px-3 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] text-[13px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]/50"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1">
            Email contact (optionnel)
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="contact@venue.fr"
            className="w-full h-8 px-3 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]/50"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1">
          Notes (optionnel)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contact presse, instructions spéciales…"
          rows={2}
          className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-md px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none resize-none focus:border-[var(--accent)]/50"
        />
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!artist.trim() || !venue.trim() || !concertDate.trim()}
          leftIcon={<Plus className="w-3 h-3" />}
        >
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
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
