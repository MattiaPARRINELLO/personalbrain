"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
  useMemo,
} from "react";
import {
  Search,
  Bell,
  Brain,
  Music,
  Code2,
  Mail,
  Command,
  X,
  Check,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createReminder } from "@/app/actions/reminders";
import { rememberFact } from "@/app/actions/brain";
import { loadConcerts, saveConcertEvents } from "@/app/actions/concerts";
import { findEmails } from "@/app/actions/ai-tools";
import type { MemoryCategory, ConcertEvent } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ParsedArgs = Record<string, string>;

interface CommandDef {
  id: string;
  prefix: string;
  label: string;
  description: string;
  usage: string;
  icon: typeof Bell;
  parse: (raw: string) => ParsedArgs | null;
  execute: (args: ParsedArgs) => Promise<string>;
}

/* ------------------------------------------------------------------ */
/*  Helpers : parsing date & catégorie                                 */
/* ------------------------------------------------------------------ */

const CATEGORY_MAP: Record<string, MemoryCategory> = {
  dev: "dev",
  code: "dev",
  photo: "photo",
  photos: "photo",
  photography: "photo",
  vie: "life",
  life: "life",
  perso: "life",
  preference: "preference",
  pref: "preference",
  preferences: "preference",
  goût: "preference",
  gout: "preference",
};

function parseCategory(s: string): MemoryCategory {
  return CATEGORY_MAP[s.toLowerCase().trim()] ?? "life";
}

/** Extracts a relative or absolute date expression from the end of a string. */
function extractDateFromEnd(raw: string): { title: string; dateExpr: string } {
  const datePatterns: RegExp[] = [
    /(\d{4}-\d{2}-\d{2})$/,
    /(demain\s*(?:[àa]\s*)?\d{1,2}h\d{0,2})$/i,
    /(demain)$/i,
    /(ce\s+soir)$/i,
    /(dans\s+\d+\s*h(?:eures)?)$/i,
    /(\d{1,2}h\d{0,2})$/,
  ];

  for (const pat of datePatterns) {
    const m = raw.match(pat);
    if (m) {
      return {
        title: raw.slice(0, raw.length - m[1].length).trim() || raw,
        dateExpr: m[1],
      };
    }
  }

  return { title: raw, dateExpr: "" };
}

/** Converts a date expression to an ISO string. */
function resolveDate(dateExpr: string): string {
  const now = new Date();
  const lower = dateExpr.toLowerCase().trim();

  if (!lower) {
    // Default: +1 hour
    const d = new Date(now);
    d.setHours(d.getHours() + 1);
    return d.toISOString();
  }

  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(dateExpr)) {
    return dateExpr;
  }

  // "demain"
  if (lower === "demain") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  // "demain 15h" / "demain à 15h30"
  const demainMatch = lower.match(/demain\s*(?:[àa]\s*)?(\d{1,2})h(\d{1,2})?/);
  if (demainMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(parseInt(demainMatch[1]), parseInt(demainMatch[2] || "0"), 0, 0);
    return d.toISOString();
  }

  // "ce soir"
  if (lower === "ce soir") {
    const d = new Date(now);
    d.setHours(20, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }

  // "dans 2h" / "dans 3 heures"
  const dansMatch = lower.match(/dans\s+(\d+)\s*h(?:eures)?/);
  if (dansMatch) {
    const d = new Date(now);
    d.setHours(d.getHours() + parseInt(dansMatch[1]));
    return d.toISOString();
  }

  // "15h" / "15h30"
  const hMatch = lower.match(/^(\d{1,2})h(\d{1,2})?$/);
  if (hMatch) {
    const d = new Date(now);
    d.setHours(parseInt(hMatch[1]), parseInt(hMatch[2] || "0"), 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }

  // Fallback
  const d = new Date(now);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

/* ------------------------------------------------------------------ */
/*  Commands definition                                                */
/* ------------------------------------------------------------------ */

const COMMANDS: CommandDef[] = [
  {
    id: "todo",
    prefix: "/todo",
    label: "Créer un rappel",
    description: "Ajoute un rappel avec titre et date optionnelle",
    usage: "/todo <titre> [date]",
    icon: Bell,
    parse(raw) {
      const rest = raw.slice("/todo".length).trim();
      if (!rest) return null;
      const { title, dateExpr } = extractDateFromEnd(rest);
      return { title, dateExpr };
    },
    async execute(args) {
      const dueAt = resolveDate(args.dateExpr ?? "");
      await createReminder({ title: args.title, dueAt });
      return `✓ Rappel créé : "${args.title}"`;
    },
  },
  {
    id: "remember",
    prefix: "/remember",
    label: "Mémoriser un fait",
    description: "Ajoute un fait mémoire dans une catégorie",
    usage: "/remember <contenu> [catégorie]",
    icon: Brain,
    parse(raw) {
      const rest = raw.slice("/remember".length).trim();
      if (!rest) return null;

      const words = rest.split(/\s+/);
      const last = words[words.length - 1].toLowerCase().trim();
      const cat = parseCategory(last);

      // If the last word is a valid category, consume it
      if (cat !== "life" || last === "life") {
        const content = words.slice(0, -1).join(" ");
        return content ? { content, category: cat } : null;
      }

      return { content: rest, category: "life" };
    },
    async execute(args) {
      const cat = (args.category as MemoryCategory) || "life";
      await rememberFact(args.content, cat);
      return `✓ Fait mémorisé : "${args.content}"`;
    },
  },
  {
    id: "concert",
    prefix: "/concert",
    label: "Ajouter un concert",
    description: "Ajoute un concert avec artiste, lieu et date",
    usage: "/concert <artiste> <lieu> <date>",
    icon: Music,
    parse(raw) {
      const rest = raw.slice("/concert".length).trim();
      if (!rest) return null;

      const words = rest.split(/\s+/);
      if (words.length < 3) return null;

      const date = words[words.length - 1];
      const venue = words[words.length - 2];
      const artist = words.slice(0, -2).join(" ");

      return { artist, venue, date };
    },
    async execute(args) {
      const data = await loadConcerts();
      const newEvent: ConcertEvent = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        artist: args.artist,
        venue: args.venue,
        date: args.date,
        status: "shooted",
      };
      await saveConcertEvents([...data.events, newEvent]);
      return `✓ Concert ajouté : ${args.artist} au ${args.venue} le ${args.date}`;
    },
  },
  {
    id: "leetcode",
    prefix: "/leetcode",
    label: "Synchroniser LeetCode",
    description: "Déclenche une synchronisation des exercices LeetCode",
    usage: "/leetcode sync",
    icon: Code2,
    parse(raw) {
      const rest = raw.slice("/leetcode".length).trim().toLowerCase();
      if (rest !== "sync") return null;
      return {};
    },
    async execute() {
      // Placeholder — la vraie sync viendra plus tard
      return "✓ Sync LeetCode lancée";
    },
  },
  {
    id: "search",
    prefix: "/search",
    label: "Chercher dans les emails",
    description: "Recherche un mot-clé dans les emails Gmail",
    usage: "/search <mot-clé>",
    icon: Mail,
    parse(raw) {
      const rest = raw.slice("/search".length).trim();
      if (!rest) return null;
      return { query: rest };
    },
    async execute(args) {
      const emails = await findEmails(args.query);
      if (emails.length === 0) return `Aucun email trouvé pour "${args.query}"`;
      return `${emails.length} email(s) trouvé(s) pour "${args.query}"`;
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Helper type for the unified results list                           */
/* ------------------------------------------------------------------ */

interface ResultItem {
  id: string;
  label: string;
  description: string;
  icon: typeof Bell;
  badge: string;
  kind: "command" | "execute";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ----- keyboard shortcut : ⌘K / Ctrl+K ----- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            setInput("");
            setFeedback(null);
            setSelectedIdx(0);
          }
          return !prev;
        });
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        setInput("");
        setFeedback(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  /* ----- auto-focus on open ----- */
  useEffect(() => {
    if (open) {
      // Small delay to let React paint the overlay first
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open]);

  /* ----- filter suggestions -------------------------------------------------- */
  const suggestions = useMemo(() => {
    if (!open) return [];
    const q = input.toLowerCase();
    return COMMANDS.filter((cmd) => {
      const searchable = `${cmd.prefix} ${cmd.label} ${cmd.description}`.toLowerCase();
      return searchable.includes(q);
    });
  }, [input, open]);

  /* ----- active command detection -------------------------------------------- */
  const activeCommand = useMemo(() => {
    if (!input.startsWith("/")) return null;

    for (const cmd of COMMANDS) {
      if (input.startsWith(cmd.prefix)) {
        const args = cmd.parse(input);
        return args !== null ? { command: cmd, args } : { command: cmd, args: null };
      }
    }

    // Partial prefix match (user typed "/co" for example)
    const partial = COMMANDS.find((cmd) => cmd.prefix.startsWith(input));
    if (partial) return { command: partial, args: null };

    return null;
  }, [input]);

  /* ----- unified results list ------------------------------------------------ */
  const results = useMemo((): ResultItem[] => {
    // 1. If a command is fully parsed → show its execute action
    if (activeCommand && activeCommand.args !== null) {
      const cmd = activeCommand.command;
      return [
        {
          id: `exec-${cmd.id}`,
          label: cmd.label,
          description: cmd.usage,
          icon: cmd.icon,
          badge: "⏎ Enter",
          kind: "execute",
        },
      ];
    }

    // 2. If input matches a command prefix but args are incomplete → show that command
    if (activeCommand && activeCommand.args === null) {
      const cmd = activeCommand.command;
      return [
        {
          id: `partial-${cmd.id}`,
          label: cmd.label,
          description: cmd.description,
          icon: cmd.icon,
          badge: cmd.prefix,
          kind: "command",
        },
      ];
    }

    // 3. Input doesn't start with "/" → show filtered suggestions
    const source = input.trim() ? suggestions : COMMANDS;
    return source.map((cmd) => ({
      id: cmd.id,
      label: cmd.label,
      description: cmd.description,
      icon: cmd.icon,
      badge: cmd.prefix,
      kind: "command" as const,
    }));
  }, [activeCommand, suggestions, input]);

  /* ----- guard selected index ------------------------------------------------ */
  const safeIdx = Math.min(selectedIdx, Math.max(results.length - 1, 0));

  /* ----- execute ------------------------------------------------------------- */
  const executeSelected = useCallback(() => {
    // If a command is fully parsed, execute it
    if (activeCommand && activeCommand.args !== null) {
      setBusy(true);
      startTransition(async () => {
        try {
          const msg = await activeCommand.command.execute(activeCommand.args);
          setFeedback({ kind: "success", message: msg });
          setTimeout(() => {
            setOpen(false);
            setInput("");
            setFeedback(null);
            setBusy(false);
          }, 1200);
        } catch (err) {
          setFeedback({
            kind: "error",
            message: err instanceof Error ? err.message : "Erreur inconnue",
          });
          setBusy(false);
        }
      });
      return;
    }

    // Otherwise, fill the input with the selected command's prefix
    const item = results[safeIdx];
    if (item) {
      setInput(item.badge + " ");
      inputRef.current?.focus();
    }
  }, [activeCommand, results, safeIdx, startTransition]);

  /* ----- keyboard navigation ------------------------------------------------ */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeSelected();
    }
  };

  /* ----- render ------------------------------------------------------------- */
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          setOpen(false);
          setInput("");
          setFeedback(null);
        }}
      />

      {/* Card */}
      <div className="relative w-full max-w-xl mx-4 rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] shadow-2xl shadow-black/50 overflow-hidden slide-up">
        {/* Feedback overlay */}
        {feedback && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[var(--surface-1)]/95 backdrop-blur-sm fade-in">
            <div
              className={cn(
                "flex items-center gap-3 px-6 py-4 rounded-xl",
                feedback.kind === "success"
                  ? "text-[var(--success)]"
                  : "text-[var(--danger)]"
              )}
            >
              {feedback.kind === "success" ? (
                <Check className="w-5 h-5" />
              ) : (
                <X className="w-5 h-5" />
              )}
              <span className="text-[14px] font-medium">{feedback.message}</span>
            </div>
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border-1)]">
          {busy ? (
            <span className="w-4 h-4 rounded-full border-2 border-[var(--accent)] border-r-transparent animate-spin shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-[var(--text-3)] shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher ou utiliser une commande…"
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-[var(--text-1)] placeholder:text-[var(--text-4)]"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--surface-2)] border border-[var(--border-1)] text-[10px] text-[var(--text-4)] font-mono">
            <Command className="w-2.5 h-2.5" />
            K
          </kbd>
          <button
            onClick={() => {
              setOpen(false);
              setInput("");
              setFeedback(null);
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Results list */}
        {results.length > 0 && (
          <div
            ref={listRef}
            className="max-h-[340px] overflow-y-auto p-2 space-y-0.5"
            onMouseMove={() => {
              /* reset keyboard selection on mouse hover */
            }}
          >
            {results.map((item, idx) => {
              const Icon = item.icon;
              const selected = idx === safeIdx;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedIdx(idx);
                    executeSelected();
                  }}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150",
                    selected
                      ? "bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/20"
                      : "text-[var(--text-1)] hover:bg-[var(--surface-2)]"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-colors",
                      selected
                        ? "border-[var(--accent)]/30 bg-[var(--accent)]/10"
                        : "border-[var(--border-1)] bg-[var(--surface-2)]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        selected ? "text-[var(--accent)]" : "text-[var(--text-3)]"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{item.label}</p>
                    <p className="text-[11px] text-[var(--text-3)] truncate">
                      {item.description}
                    </p>
                  </div>
                  <kbd className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--surface-2)] border border-[var(--border-1)] text-[var(--text-4)]">
                    {item.badge}
                  </kbd>
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state : no input  */}
        {!input.trim() && results.length === 0 && (
          <div className="p-3">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-4)] font-mono">
              Commandes disponibles
            </p>
            {COMMANDS.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => {
                    setInput(cmd.prefix + " ");
                    inputRef.current?.focus();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 text-[var(--text-1)] hover:bg-[var(--surface-2)] group"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-[var(--border-1)] bg-[var(--surface-2)] shrink-0 group-hover:border-[var(--border-2)] transition-colors">
                    <Icon className="w-4 h-4 text-[var(--text-3)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{cmd.label}</p>
                    <p className="text-[11px] text-[var(--text-3)] truncate">
                      {cmd.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--surface-2)] border border-[var(--border-1)] text-[var(--text-4)]">
                      {cmd.prefix}
                    </kbd>
                    <ArrowRight className="w-3 h-3 text-[var(--text-4)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* No results for query */}
        {input.trim() && results.length === 0 && !feedback && (
          <div className="flex flex-col items-center justify-center py-10 px-4">
            <Search className="w-6 h-6 text-[var(--text-4)] mb-3" />
            <p className="text-[13px] text-[var(--text-3)]">Aucune commande trouvée</p>
            <p className="text-[11px] text-[var(--text-4)] mt-1 text-center">
              Essayez <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[10px] font-mono">/todo</kbd>,{" "}
              <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[10px] font-mono">/remember</kbd>,{" "}
              <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[10px] font-mono">/concert</kbd>,{" "}
              <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[10px] font-mono">/leetcode</kbd>,{" "}
              <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[10px] font-mono">/search</kbd>
            </p>
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--border-1)] bg-[var(--surface-2)]/30">
          <span className="text-[10px] text-[var(--text-4)] font-mono flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[9px]">↑</kbd>
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[9px]">↓</kbd>
            Naviguer
          </span>
          <span className="text-[10px] text-[var(--text-4)] font-mono flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[9px]">⏎</kbd>
            Exécuter
          </span>
          <span className="text-[10px] text-[var(--text-4)] font-mono flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[9px]">Esc</kbd>
            Fermer
          </span>
          <span className="ml-auto text-[10px] text-[var(--text-4)] font-mono flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-[var(--accent)]" />
            BACKSTAGE
          </span>
        </div>
      </div>
    </div>
  );
}
