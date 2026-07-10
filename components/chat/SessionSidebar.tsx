"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Search, Plus, Trash2, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  context?: "code" | "photo" | "general";
  preview?: string;
};

function relativeDate(iso: string): string {
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffSec = Math.floor((now - then) / 1000);
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
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function SessionSidebar({ activeSessionId, onSelectSession, onNewSession, mobileOpen, onMobileClose }: SessionSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    import("@/app/actions/chat-history").then(({ getChatHistory }) => {
      getChatHistory().then((history) => {
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
      });
    });
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
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { deleteChatSession } = await import("@/app/actions/chat-history");
    await deleteChatSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const getDotColor = (ctx?: string) => {
    if (ctx === "code") return "bg-[var(--accent-cool)]";
    if (ctx === "photo") return "bg-[var(--accent-warm)]";
    return "bg-[var(--text-3)]";
  };

  return (
    <div className={cn(
      "w-60 shrink-0 h-full flex-col border-r border-[var(--border-1)] bg-[var(--surface-1)]",
      "hidden lg:flex",
      mobileOpen && "fixed inset-y-0 left-0 z-40 flex shadow-2xl"
    )}>
      <div className="flex flex-col items-center pb-2">
        <div className="relative group/logo">
          <Image
            src="/backstage-logo.png"
            alt="BACKSTAGE"
            width={120}
            height={120}
            priority
            className="w-[100px] h-[100px] object-contain drop-shadow-[0_0_12px_rgba(165,180,252,0.18)] transition-all duration-500 ease-out group-hover/logo:drop-shadow-[0_0_20px_rgba(165,180,252,0.30)] group-hover/logo:translate-y-[-3px]"
          />
        </div>
        <h1 className="mt-2 text-[13px] font-black tracking-[0.25em] uppercase text-[var(--text-1)] font-mono">
          BACKSTAGE
        </h1>
        <p className="mt-0.5 text-[10px] text-[var(--text-2)] tracking-wide font-mono">
          Ton espace de contrôle personnel.
        </p>
        {mobileOpen && onMobileClose && (
          <button
            onClick={onMobileClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors lg:hidden"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-3">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--text-2)] border border-dashed border-[var(--border-2)] rounded-lg hover:border-[var(--accent-cool)] hover:text-[var(--accent-cool)] transition-colors duration-200"
        >
          <Plus className="w-3.5 h-3.5" />
          Nouvelle conversation
        </button>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-4)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-7.5 pr-2.5 py-1.5 text-[12px] text-[var(--text-2)] bg-[var(--surface-2)] border border-[var(--border-1)] rounded-md placeholder:text-[var(--text-4)] outline-none focus:border-[var(--border-2)] transition-colors duration-200"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="w-4 h-4 text-[var(--text-4)] mx-auto mb-2" />
            <p className="text-[11px] text-[var(--text-4)] font-mono">
              {search ? "Aucun résultat" : "Aucune conversation"}
            </p>
          </div>
        ) : (
          <div className="px-3 pb-3 space-y-4">
            {Array.from(grouped.entries()).map(([group, groupSessions]) => (
              <div key={group}>
                <h3 className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--text-4)] font-mono mb-1.5 px-1">
                  {group}
                </h3>
                <div className="space-y-0.5">
                  {groupSessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleSelect(s.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSelect(s.id); }}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded-lg group transition-colors duration-150",
                        s.id === activeSessionId
                          ? "bg-[var(--surface-3)] border border-[var(--border-2)]"
                          : "border border-transparent hover:bg-[var(--surface-2)] hover:border-[var(--border-1)]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", getDotColor(s.context))} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] text-[var(--text-2)] truncate leading-tight font-mono">
                            {s.title}
                          </p>
                          <p className="text-[10px] text-[var(--text-4)] font-mono mt-0.5">
                            {relativeDate(s.updatedAt)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, s.id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--text-4)] hover:text-[var(--danger)] transition-all duration-150"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
