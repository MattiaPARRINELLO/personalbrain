"use client";

import { useMemo, useState } from "react";
import { Activity, ChevronDown, ChevronUp, RefreshCw, Search, ShieldAlert, Terminal } from "lucide-react";
import { loadDemoCalls } from "@/app/actions/demo-calls";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, PageHeader } from "@/components/layout/Chrome";
import { cn } from "@/lib/utils";
import type { DemoCallEntry, DemoCallOutcome } from "@/lib/types";

const OUTCOME_LABELS: Record<DemoCallOutcome, string> = {
  success: "Succès",
  rate_limited: "Quota atteint",
  invalid_json: "JSON invalide",
  invalid_input: "Entrée invalide",
  configuration_error: "Configuration IA",
  empty_response: "Réponse vide",
  provider_error: "Erreur fournisseur",
  timeout: "Délai dépassé",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function matches(call: DemoCallEntry, query: string): boolean {
  if (!query) return true;
  const needle = query.toLocaleLowerCase("fr-FR");
  return [call.input, call.response, call.error, call.ip, call.userAgent, call.requestId]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase("fr-FR").includes(needle));
}

export function DemoCallsView({ initialCalls }: { initialCalls: DemoCallEntry[] }) {
  const [calls, setCalls] = useState(initialCalls);
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<"all" | DemoCallOutcome>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => calls.filter((call) => (outcome === "all" || call.outcome === outcome) && matches(call, query)),
    [calls, outcome, query]
  );

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setCalls(await loadDemoCalls(1000));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les appels");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 overflow-y-auto p-6">
        <PageHeader
          eyebrow="Console privée"
          title="Appels de la démo"
          description="Journal des requêtes IA publiques, avec contenu envoyé, réponse et métadonnées d’abus potentielles."
          actions={
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border-1)] px-3 text-[12px] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Actualiser
            </button>
          }
        />

        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/60 p-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-4)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher dans les appels…"
              className="h-10 w-full rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] pl-9 pr-3 text-[12px] text-[var(--text-1)] outline-none placeholder:text-[var(--text-4)] focus:border-[var(--accent)]"
            />
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[var(--text-3)]">
            Résultat
            <select
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as "all" | DemoCallOutcome)}
              className="h-10 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-[12px] text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
            >
              <option value="all">Tous</option>
              {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <span className="shrink-0 font-mono text-[10px] text-[var(--text-4)]">
            {filtered.length} / {calls.length}
          </span>
        </div>

        {error && <p className="mb-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-[12px] text-[var(--danger)]" role="alert">{error}</p>}

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Terminal className="h-5 w-5" />}
            title={calls.length === 0 ? "Aucun appel enregistré" : "Aucun résultat"}
            description={calls.length === 0 ? "Les prochains appels à /api/demo apparaîtront ici." : "Modifiez votre recherche ou votre filtre."}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((call) => {
              const isOpen = expanded === call.id;
              const success = call.outcome === "success";
              return (
                <article key={call.id} className="overflow-hidden rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/70">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : call.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]/60"
                    aria-expanded={isOpen}
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", success ? "bg-[var(--success)]" : call.outcome === "rate_limited" ? "bg-[var(--warm)]" : "bg-[var(--danger)]")} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cn("text-[11px] font-medium", success ? "text-[var(--success)]" : call.outcome === "rate_limited" ? "text-[var(--warm)]" : "text-[var(--danger)]")}>{OUTCOME_LABELS[call.outcome]}</span>
                        <span className="font-mono text-[10px] text-[var(--text-4)]">{formatDate(call.createdAt)}</span>
                        <span className="font-mono text-[10px] text-[var(--text-4)]">{call.status} · {call.durationMs} ms</span>
                      </span>
                      <span className="mt-1 block truncate text-[12px] text-[var(--text-1)]">{call.input ?? "Aucun contenu reçu"}</span>
                      <span className="mt-1 block truncate font-mono text-[10px] text-[var(--text-4)]">{call.ip} · {call.userAgent}</span>
                    </span>
                    {isOpen ? <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-[var(--text-4)]" /> : <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[var(--text-4)]" />}
                  </button>

                  {isOpen && (
                    <div className="space-y-4 border-t border-[var(--border-1)] px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Meta label="Requête" value={call.requestId} mono />
                        <Meta label="IP" value={call.ip} mono />
                        <Meta label="Modèle" value={call.model} mono />
                        <Meta label="Durée" value={`${call.durationMs} ms`} mono />
                        <Meta label="X-Forwarded-For" value={call.forwardedFor || "—"} mono />
                        <Meta label="X-Real-IP" value={call.realIp || "—"} mono />
                        <Meta label="User-Agent" value={call.userAgent} />
                        <Meta label="Referer" value={call.referer} />
                      </div>
                      <div>
                        <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)]"><Activity className="h-3.5 w-3.5" /> Question reçue</p>
                        <pre className="whitespace-pre-wrap rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]/60 p-3 text-[12px] leading-relaxed text-[var(--text-1)]">{call.input ?? "—"}</pre>
                      </div>
                      {call.response && (
                        <div>
                          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)]">Réponse IA</p>
                          <pre className="whitespace-pre-wrap rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]/60 p-3 text-[12px] leading-relaxed text-[var(--text-1)]">{call.response}</pre>
                        </div>
                      )}
                      {call.error && (
                        <div className="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/8 p-3 text-[12px] text-[var(--danger)]">
                          <p className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]"><ShieldAlert className="h-3.5 w-3.5" /> Erreur</p>
                          {call.error}
                        </div>
                      )}
                      {call.sources.length > 0 && (
                        <div>
                          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)]">Sources sélectionnées</p>
                          <div className="flex flex-wrap gap-2">
                            {call.sources.map((source) => <span key={`${source.kind}-${source.title}`} className="rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-2 py-1 text-[10px] text-[var(--text-2)]">{source.kind} · {source.title}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-4)]">{label}</p>
      <p className={cn("mt-1 truncate text-[11px] text-[var(--text-2)]", mono && "font-mono")} title={value}>{value}</p>
    </div>
  );
}
