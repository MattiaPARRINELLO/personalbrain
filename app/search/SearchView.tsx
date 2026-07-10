"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ArrowUpRight, Music, Brain, Mail, Bell, Bookmark, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/layout/Chrome";
import { cn } from "@/lib/utils";
import { unifiedSearch, type UnifiedSearchResult } from "@/app/actions/search";
import type { ConcertEvent, MemoryFact, Email, Reminder, WatchLaterItem, Accreditation } from "@/lib/types";

const ICONS = {
  concerts: Music,
  facts: Brain,
  emails: Mail,
  reminders: Bell,
  watchLater: Bookmark,
  accreditations: ShieldCheck,
} as const;

const LABELS: Record<keyof UnifiedSearchResult, string> = {
  concerts: "Concerts",
  facts: "Mémoire",
  emails: "Emails",
  reminders: "Rappels",
  watchLater: "À voir",
  accreditations: "Accréditations",
};

const COLORS: Record<keyof UnifiedSearchResult, string> = {
  concerts: "text-[var(--warm)]",
  facts: "text-[var(--success)]",
  emails: "text-[var(--accent)]",
  reminders: "text-[var(--accent)]",
  watchLater: "text-[var(--accent-soft)]",
  accreditations: "text-[var(--accent)]",
};

function countResults(r: UnifiedSearchResult): number {
  return Object.values(r).reduce((a, b) => a + b.length, 0);
}

export function SearchView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    clearTimeout(timerRef.current);
    if (!value.trim()) {
      setResults(null);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await unifiedSearch(value.trim());
        setResults(r);
      } catch {
        setResults(null);
      }
      setLoading(false);
    }, 250);
  }

  return (
    <AppShell>
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
        <div className="shrink-0 p-4 sm:p-6 border-b border-[var(--border-1)]">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)] pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Rechercher dans les concerts, emails, rappels, mémoire, accréditations, watch-later…"
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-4)] outline-none focus:border-[var(--accent)] transition-colors"
            />
            {loading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-[var(--accent)] border-r-transparent animate-spin" />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!results && !loading && (
            <EmptyState
              icon={<Search className="w-5 h-5" />}
              title="Recherche unifiée"
              description="Tape une requête pour chercher dans toutes les données de BACKSTAGE."
            />
          )}

          {results && countResults(results) === 0 && !loading && (
            <EmptyState
              icon={<Search className="w-5 h-5" />}
              title="Aucun résultat"
              description={`Rien trouvé pour "${query}". Essaie d'autres mots-clés.`}
            />
          )}

          {results && countResults(results) > 0 && (
            <div className="max-w-2xl space-y-6">
              {(Object.keys(LABELS) as (keyof UnifiedSearchResult)[]).map((key) => {
                const items = results[key];
                if (items.length === 0) return null;
                const Icon = ICONS[key];
                return (
                  <section key={key}>
                    <h3 className={cn(
                      "flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] font-mono mb-2",
                      COLORS[key]
                    )}>
                      <Icon className="w-3 h-3" />
                      {LABELS[key]}
                      <span className="text-[var(--text-4)] font-normal normal-case ml-1">({items.length})</span>
                    </h3>
                    <div className="space-y-0.5">
                      {items.map((item) => (
                        <ResultRow key={item.id} item={item} type={key} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

type SearchItem = ConcertEvent | MemoryFact | Email | Reminder | WatchLaterItem | Accreditation;

function ResultRow({ item, type }: { item: SearchItem; type: string }) {
  const title = "artist" in item ? item.artist : "title" in item ? item.title : "content" in item ? item.content : "from" in item ? item.from : "";
  const sub = type === "concerts"
    ? `${(item as ConcertEvent).venue} · ${(item as ConcertEvent).date}`
    : type === "emails"
    ? `${(item as Email).subject}`
    : type === "reminders"
    ? `Échéance : ${new Date((item as Reminder).dueAt).toLocaleDateString("fr-FR")}`
    : type === "watchLater"
    ? ((item as WatchLaterItem).description || "")
    : type === "accreditations"
    ? `${(item as Accreditation).venue} · ${(item as Accreditation).status}`
    : "";

  return (
    <a
      href={getHref(item, type)}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors group"
    >
      <span className="text-[13px] text-[var(--text-1)] flex-1 min-w-0 truncate">{String(title)}</span>
      {sub && <span className="text-[11px] text-[var(--text-3)] shrink-0 hidden sm:block truncate max-w-[200px]">{sub}</span>}
      <ArrowUpRight className="w-3 h-3 text-[var(--text-4)] group-hover:text-[var(--text-1)] shrink-0 transition-colors" />
    </a>
  );
}

function getHref(item: SearchItem, type: string): string {
  switch (type) {
    case "concerts": return "/";
    case "facts": return "/brain";
    case "emails": return "/";
    case "reminders": return "/reminders";
    case "watchLater": return "/watch-later";
    case "accreditations": return "/photos";
    default: return "/";
  }
}
