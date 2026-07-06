"use client";

import { useState, useEffect } from "react";
import { Settings2, X, Sparkles, Loader2, Mail, CalendarRange, Brain, Bookmark, Bell, Globe, SendHorizontal, CalendarPlus, Inbox, ListChecks, Lightbulb } from "lucide-react";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { GmailWidget } from "@/components/widgets/GmailWidget";
import { LeetCodeWidget } from "@/components/widgets/LeetCodeWidget";
import { AccreditationsWidget } from "@/components/widgets/AccreditationsWidget";
import { useChatContext, type ContextTool } from "@/lib/chat-context";
import { cn } from "@/lib/utils";

type View = "all" | "calendar" | "gmail" | "leetcode" | "accreditations";

const TOOL_CONTEXT_MAP: Record<string, "calendar" | "gmail" | "memory" | "reminder" | "watch" | "search"> = {
  create_calendar_event: "calendar",
  search_calendar_events: "calendar",
  fetch_and_search_emails: "gmail",
  send_email_response: "gmail",
  triage_emails: "gmail",
  add_memory_fact: "memory",
  add_reminder: "reminder",
  add_watch_later: "watch",
  web_search: "search",
  fetch_page_meta: "search",
  lookup_concerts: "search",
};

const CONTEXT_LABELS: Record<string, { title: string; icon: typeof Sparkles }> = {
  calendar: { title: "Calendrier", icon: CalendarRange },
  gmail: { title: "Boîte de réception", icon: Mail },
  memory: { title: "Mémoire", icon: Brain },
  reminder: { title: "Rappels", icon: Bell },
  watch: { title: "À voir", icon: Bookmark },
  search: { title: "Recherche", icon: Globe },
};

function pickContextKey(tools: Record<string, ContextTool>): string | null {
  const running = Object.values(tools);
  if (running.length > 0) {
    const last = running[running.length - 1];
    return TOOL_CONTEXT_MAP[last.name] ?? null;
  }
  return null;
}

export function ContextPanel() {
  const [view, setView] = useState<View>("all");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const chatCtx = useChatContext();

  const contextKey = pickContextKey(chatCtx.activeTools);
  const lastTool = chatCtx.lastFinishedTool;
  const lastToolKey = lastTool ? TOOL_CONTEXT_MAP[lastTool.name] ?? null : null;
  const activeContext = contextKey ?? lastToolKey;

  return (
    <>
      {chatCtx.busy && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="xl:hidden fixed bottom-20 right-3 z-30 w-10 h-10 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/40 text-[var(--accent-soft)] flex items-center justify-center backdrop-blur"
          aria-label="Ouvrir le contexte"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
        </button>
      )}

      <aside
        className={cn(
          "flex flex-col shrink-0 h-full border-l border-[var(--border-1)] bg-[var(--surface-1)]/40 backdrop-blur transition-[width,transform] duration-300 ease-out",
          "xl:relative xl:translate-x-0",
          collapsed ? "xl:w-12" : "xl:w-[340px]",
          mobileOpen
            ? "fixed inset-x-0 bottom-0 top-auto z-40 w-full rounded-t-2xl border-l-0 border-t border-[var(--border-1)] shadow-2xl"
            : "hidden xl:flex",
          mobileOpen && "max-h-[80vh]"
        )}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--border-1)] shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              {activeContext ? (
                <ContextBadge contextKey={activeContext} />
              ) : (
                <ViewSwitcher view={view} onChange={setView} />
              )}
            </div>
          )}
          <button
            onClick={() => {
              if (mobileOpen) {
                setMobileOpen(false);
              } else {
                setCollapsed((c) => !c);
              }
            }}
            className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
            title={mobileOpen ? "Fermer" : collapsed ? "Étendre" : "Réduire"}
          >
            {mobileOpen ? <X className="w-3.5 h-3.5" /> : collapsed ? <Settings2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          </button>
        </div>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3 context-panel-body">
            {activeContext ? (
              <ContextualView
                contextKey={activeContext}
                runningTools={Object.values(chatCtx.activeTools)}
                lastTool={lastTool}
                onDismissLast={() => chatCtx.dismissLastFinishedTool()}
              />
            ) : (
              <>
                {(view === "all" || view === "calendar") && <CalendarWidget />}
                {(view === "all" || view === "gmail") && <GmailWidget />}
                {(view === "all" || view === "leetcode") && <LeetCodeWidget />}
                {(view === "all" || view === "accreditations") && <AccreditationsWidget />}
                {view === "all" && <UrgentRemindersWidget />}
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function ContextBadge({ contextKey }: { contextKey: string }) {
  const meta = CONTEXT_LABELS[contextKey];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30">
      <Icon className="w-3 h-3 text-[var(--accent-soft)]" />
      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent-soft)]">
        {meta.title}
      </span>
    </div>
  );
}

function ViewSwitcher({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const tabs: { id: View; label: string }[] = [
    { id: "all", label: "Tout" },
    { id: "calendar", label: "Agenda" },
    { id: "gmail", label: "Inbox" },
    { id: "leetcode", label: "Code" },
    { id: "accreditations", label: "Accréd." },
  ];
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-1)]">
      {tabs.map((t) => {
        const active = view === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-medium font-mono uppercase tracking-wider transition-all duration-200",
              active
                ? "bg-[var(--surface-3)] text-[var(--text-1)] shadow-sm"
                : "text-[var(--text-3)] hover:text-[var(--text-1)]"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ContextualView({
  contextKey,
  runningTools,
  lastTool,
  onDismissLast,
}: {
  contextKey: string;
  runningTools: ContextTool[];
  lastTool: ContextTool | null;
  onDismissLast: () => void;
}) {
  return (
    <div className="context-view-enter space-y-3">
      {runningTools.length > 0 && (
        <RunningToolsCard tools={runningTools} />
      )}
      {contextKey === "calendar" && (
        <div className={cn(runningTools.length > 0 && "context-pulse")}>
          <CalendarWidget />
        </div>
      )}
      {contextKey === "gmail" && <GmailWidget />}
      {contextKey === "memory" && <MemoryContextCard lastTool={lastTool} />}
      {contextKey === "reminder" && <ReminderContextCard lastTool={lastTool} />}
      {contextKey === "watch" && <WatchContextCard lastTool={lastTool} />}
      {contextKey === "search" && <SearchContextCard lastTool={lastTool} />}

      {lastTool && runningTools.length === 0 && (
        <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-4)] px-1">
          Dernier résultat
        </div>
      )}
      {lastTool && runningTools.length === 0 && (
        <button
          onClick={onDismissLast}
          className="text-[10px] text-[var(--text-3)] hover:text-[var(--text-1)] underline-offset-2 hover:underline self-start"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}

function RunningToolsCard({ tools }: { tools: ContextTool[] }) {
  return (
    <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--accent-soft)]">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Outils en cours</span>
      </div>
      {tools.map((t) => {
        const meta = TOOL_LABELS[t.name];
        const Icon = meta?.icon ?? Sparkles;
        return (
          <div
            key={t.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--surface-2)] border border-[var(--border-1)]"
          >
            <Icon className="w-3 h-3 text-[var(--accent-soft)]" />
            <span className="text-[11px] text-[var(--text-1)] truncate">{meta?.label ?? t.name}</span>
            <ToolDuration startedAt={t.startedAt} />
          </div>
        );
      })}
    </div>
  );
}

function ToolDuration({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(id);
  }, [startedAt]);
  return (
    <span className="ml-auto text-[10px] text-[var(--text-4)] font-mono">
      {(elapsed / 1000).toFixed(1)}s
    </span>
  );
}

const TOOL_LABELS: Record<string, { label: string; icon: typeof Sparkles }> = {
  web_search: { label: "Recherche web", icon: Globe },
  fetch_and_search_emails: { label: "Consultation Gmail", icon: Mail },
  send_email_response: { label: "Envoi email", icon: SendHorizontal },
  create_calendar_event: { label: "Création événement", icon: CalendarPlus },
  add_memory_fact: { label: "Mémorisation", icon: Brain },
  add_reminder: { label: "Nouveau rappel", icon: Bell },
  add_watch_later: { label: "Ajout à la liste", icon: Bookmark },
  search_calendar_events: { label: "Recherche agenda", icon: CalendarRange },
  lookup_concerts: { label: "Concerts", icon: Globe },
  triage_emails: { label: "Tri emails", icon: ListChecks },
  fetch_page_meta: { label: "Aperçu lien", icon: Inbox },
};

function MemoryContextCard({ lastTool }: { lastTool: ContextTool | null }) {
  return (
    <div className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Brain className="w-3.5 h-3.5 text-[var(--accent-soft)]" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-3)]">
          Faits utilisés
        </span>
      </div>
      {lastTool?.result ? (
        <p className="text-[12px] text-[var(--text-1)] leading-relaxed whitespace-pre-wrap">
          {lastTool.result}
        </p>
      ) : (
        <p className="text-[12px] text-[var(--text-3)]">
          L'IA puise dans ta mémoire longue pour contextualiser ses réponses.
        </p>
      )}
    </div>
  );
}

function ReminderContextCard({ lastTool }: { lastTool: ContextTool | null }) {
  return (
    <div className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Bell className="w-3.5 h-3.5 text-[var(--warm)]" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-3)]">
          Rappel créé
        </span>
      </div>
      {lastTool?.result ? (
        <p className="text-[12px] text-[var(--text-1)] leading-relaxed whitespace-pre-wrap">
          {lastTool.result}
        </p>
      ) : (
        <p className="text-[12px] text-[var(--text-3)]">L'IA ajoute un rappel à ton agenda.</p>
      )}
    </div>
  );
}

function WatchContextCard({ lastTool }: { lastTool: ContextTool | null }) {
  return (
    <div className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Bookmark className="w-3.5 h-3.5 text-[var(--accent-warm)]" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-3)]">
          Ajouté à la liste
        </span>
      </div>
      {lastTool?.result ? (
        <p className="text-[12px] text-[var(--text-1)] leading-relaxed whitespace-pre-wrap">
          {lastTool.result}
        </p>
      ) : (
        <p className="text-[12px] text-[var(--text-3)]">L'IA classe un lien pour plus tard.</p>
      )}
    </div>
  );
}

function SearchContextCard({ lastTool }: { lastTool: ContextTool | null }) {
  return (
    <div className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Lightbulb className="w-3.5 h-3.5 text-[var(--accent-cool)]" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-3)]">
          Résultats de recherche
        </span>
      </div>
      {lastTool?.result ? (
        <p className="text-[12px] text-[var(--text-1)] leading-relaxed whitespace-pre-wrap line-clamp-8">
          {lastTool.result}
        </p>
      ) : (
        <p className="text-[12px] text-[var(--text-3)]">L'IA parcourt le web pour toi.</p>
      )}
    </div>
  );
}

function UrgentRemindersWidget() {
  return (
    <div className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Bell className="w-3.5 h-3.5 text-[var(--warm)]" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-3)]">
          Rappels urgents
        </span>
      </div>
      <p className="text-[12px] text-[var(--text-3)]">
        Consulte la page Rappels pour la liste complète.
      </p>
    </div>
  );
}
