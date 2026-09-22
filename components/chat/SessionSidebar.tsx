"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Plus, Trash2, MessageSquare, X, Code2, Camera, Bell, Flame, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { useCachedFetch } from "@/lib/cache";
import { getHomeOverview } from "@/app/actions/home";
import { GMAIL_CACHE_KEY, fetchInboxMessages } from "@/components/widgets/GmailWidget";
import type { HomeOverview } from "@/lib/types";

type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  context?: "code" | "photo" | "general";
  preview?: string;
};

const CONTEXT_ICON = {
  code: { icon: Code2, className: "text-[var(--accent-cool)]", label: "Code" },
  photo: { icon: Camera, className: "text-[var(--accent-warm)]", label: "Photo" },
  general: { icon: MessageSquare, className: "text-[var(--text-4)]", label: "Général" },
} as const;

function relativeDate(iso: string): string {
  try {
    const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return "À l'instant";
    if (diffSec < 3600) return `Il y a ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `Il y a ${Math.floor(diffSec / 3600)} h`;
    if (diffSec < 172800) return "Hier";
    if (diffSec < 604800) return `Il y a ${Math.floor(diffSec / 86400)} j`;
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return "";
  }
}

function dayGroup(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today.getTime() - target.getTime()) / 86400000);
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "Date inconnue";
  }
}

interface SessionSidebarProps {
  activeSessionId?: string;
  onSelectSession: (session: { id: string; title: string; messages: { id: string; role: "user" | "assistant"; content: string; timestamp: string; toolCalls?: { id: string; name: string; arguments?: string; result?: string; status: "running" | "success" | "error"; duration?: number; resultCount?: number }[] }[] }) => void;
  onNewSession: () => void;
  onDeleteSession?: (id: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function SessionSidebar({ activeSessionId, onSelectSession, onNewSession, onDeleteSession, mobileOpen, onMobileClose }: SessionSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    import("@/app/actions/chat-history")
      .then(({ getChatHistory }) => getChatHistory())
      .then((history) => {
        if (cancelled) return;
        const list: ChatSession[] = history.sessions
          .map((s) => ({
            id: s.id,
            title: s.title || "Nouvelle conversation",
            updatedAt: s.updatedAt || s.createdAt,
            context: s.context,
            preview: s.messages.length > 0
              ? s.messages[s.messages.length - 1].content.slice(0, 60)
              : "",
          }))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setSessions(list);
      })
      .catch((err) => {
        console.error("[session-sidebar] Chargement des sessions échoué:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  const filtered = search
    ? sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : sessions;

  const grouped = new Map<string, ChatSession[]>();
  for (const s of filtered) {
    const group = dayGroup(s.updatedAt);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(s);
  }

  const handleSelect = async (id: string) => {
    try {
      const { getChatHistory } = await import("@/app/actions/chat-history");
      const history = await getChatHistory();
      const session = history.sessions.find((s) => s.id === id);
      if (!session) return;
      onSelectSession({
        id: session.id,
        title: session.title,
        messages: session.messages.map((m) => ({
          ...m,
          toolCalls: m.toolCalls?.map((tc) => ({
            ...tc,
            status: (tc.status || "success") as "running" | "success" | "error",
          })),
        })),
      });
    } catch (err) {
      console.error("[session-sidebar] Sélection de session échouée:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { deleteChatSession } = await import("@/app/actions/chat-history");
      await deleteChatSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      onDeleteSession?.(id);
    } catch (err) {
      // La session reste affichée : on ne supprime pas l'entrée en cas d'échec.
      console.error("[session-sidebar] Suppression de session échouée:", err);
    }
  };

  return (
    <aside
      aria-label="Historique des conversations"
      className={cn(
        "w-60 shrink-0 h-full flex-col border-r border-[var(--border-1)] bg-[var(--surface-1)]",
        "hidden lg:flex",
        mobileOpen && "fixed inset-y-0 left-0 z-40 flex"
      )}
    >
      <header className="panel-sheen shrink-0 flex items-center gap-2.5 px-3 h-14 border-b border-[var(--border-1)]">
        <div className="relative shrink-0 w-8 h-8 flex items-center justify-center">
          <span
            className="home-halo absolute inset-[-4px] rounded-full bg-[var(--accent)]/25 blur-[10px]"
            aria-hidden
          />
          <span className="relative w-8 h-8 rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] flex items-center justify-center overflow-hidden">
            <Image
              src="/backstage-logo-simple.png"
              alt=""
              width={22}
              height={22}
              priority
              className="w-[22px] h-[22px] object-contain"
            />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[11px] font-black tracking-[0.22em] uppercase text-[var(--text-1)] font-mono leading-none">
            Backstage
          </h1>
          <p className="mt-1 text-[10px] text-[var(--text-3)] font-mono truncate leading-none">
            Ton espace de contrôle
          </p>
        </div>
        {mobileOpen && onMobileClose && (
          <button
            onClick={onMobileClose}
            aria-label="Fermer"
            className="shrink-0 w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors lg:hidden"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </header>

      <div className="shrink-0 px-3 py-3 space-y-2">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg hover:bg-[var(--accent)]/15 hover:border-[var(--accent)]/50 transition-colors duration-200"
        >
          <Plus className="w-3.5 h-3.5" />
          Nouvelle conversation
        </button>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-4)]" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-7 pr-7 py-1.5 text-[12px] text-[var(--text-2)] bg-[var(--surface-2)]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Effacer la recherche"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-[var(--text-4)] hover:text-[var(--text-1)] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <MessageSquare className="w-4 h-4 text-[var(--text-4)] mx-auto mb-2.5" />
            <p className="text-[11px] text-[var(--text-4)] font-mono">
              {search ? "Aucun résultat" : "Aucune conversation"}
              <span className="home-caret" aria-hidden>
                ▍
              </span>
            </p>
          </div>
        ) : (
          <div className="px-3 pb-3 space-y-4">
            {Array.from(grouped.entries()).map(([group, groupSessions]) => (
              <section key={group}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <h3 className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--text-4)]">
                    {group}
                  </h3>
                  <span className="text-[9px] font-mono tabular-nums text-[var(--text-4)]/70">
                    {groupSessions.length}
                  </span>
                  <span className="flex-1 h-px bg-[var(--border-1)]" />
                </div>
                <ul className="space-y-0.5">
                  {groupSessions.map((s) => {
                    const active = s.id === activeSessionId;
                    const ctx = CONTEXT_ICON[s.context ?? "general"];
                    const CtxIcon = ctx.icon;
                    return (
                      <li key={s.id} className="relative group">
                        <button
                          onClick={() => void handleSelect(s.id)}
                          title={s.preview ? `${s.title} — ${s.preview}` : s.title}
                          className={cn(
                            "w-full text-left pl-2.5 pr-8 py-2 rounded-lg transition-colors duration-150 border",
                            active
                              ? "bg-[var(--surface-3)] border-[var(--border-2)]"
                              : "border-transparent hover:bg-[var(--surface-2)] hover:border-[var(--border-1)]"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <CtxIcon
                              className={cn("w-3 h-3 shrink-0", active ? ctx.className : "text-[var(--text-4)]")}
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  "block text-[12px] truncate leading-tight font-mono",
                                  active ? "text-[var(--text-1)]" : "text-[var(--text-2)]"
                                )}
                              >
                                {s.title}
                              </span>
                              <span className="block text-[10px] text-[var(--text-4)] font-mono mt-0.5">
                                {relativeDate(s.updatedAt)}
                              </span>
                            </span>
                          </span>
                        </button>
                        {active && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[var(--accent)]"
                            aria-hidden
                          />
                        )}
                        <button
                          onClick={() => void handleDelete(s.id)}
                          title="Supprimer"
                          aria-label={`Supprimer ${s.title}`}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-4)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--danger)] hover:bg-[var(--surface-3)] transition-all duration-150"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <SidebarStats />
    </aside>
  );
}

/** Bandeau de bas de sidebar : trois compteurs issus du cache déjà chargé par
 *  l'accueil (aucune requête supplémentaire). */
function SidebarStats() {
  const { data: overview } = useCachedFetch<HomeOverview>("home:overview", getHomeOverview, {
    ttl: 60_000,
  });
  const { data: messages } = useCachedFetch(GMAIL_CACHE_KEY, fetchInboxMessages, {
    ttl: 2 * 60 * 1000,
  });

  const unread = (messages ?? []).filter((m) => m.unread).length;
  const reminders = (overview?.remindersToday.length ?? 0) + (overview?.remindersLateCount ?? 0);
  const streak = overview?.leetcodeStreak ?? 0;

  const stats = [
    { key: "reminders", icon: Bell, value: reminders, href: "/reminders", label: "Rappels ouverts", tone: "text-[var(--accent-warm)]" },
    { key: "mail", icon: Mail, value: unread, href: "/gmail", label: "Mails non lus", tone: "text-[var(--accent)]" },
    { key: "streak", icon: Flame, value: streak, href: "/leetcode", label: "Série LeetCode", tone: "text-[var(--warm)]" },
  ];

  return (
    <div className="shrink-0 border-t border-[var(--border-1)] px-2 py-2">
      <div className="flex items-stretch gap-1">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.key}
              href={s.href}
              title={s.label}
              aria-label={s.label}
              className="flex-1 min-w-0 flex flex-col items-center gap-1 py-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors duration-150"
            >
              <Icon className={cn("w-3.5 h-3.5", s.tone)} />
              <span className="text-[11px] font-mono tabular-nums text-[var(--text-2)] leading-none">
                {s.value}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
