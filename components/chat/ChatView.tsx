"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  Globe,
  Mail,
  SendHorizontal,
  CalendarPlus,
  Brain,
  Bookmark,
  Bell,
  Square,
} from "lucide-react";
import { api, type ChatStreamEvent } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/Markdown";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
};

type ToolCall = {
  id: string;
  name: string;
  result: string;
  status: "running" | "done";
};

const toolMeta: Record<string, { label: string; icon: typeof Globe }> = {
  web_search: { label: "Recherche web", icon: Globe },
  fetch_and_search_emails: { label: "Consultation Gmail", icon: Mail },
  send_email_response: { label: "Envoi email", icon: SendHorizontal },
  create_calendar_event: { label: "Création calendrier", icon: CalendarPlus },
  add_memory_fact: { label: "Mémoire", icon: Brain },
  add_reminder: { label: "Rappel", icon: Bell },
  add_watch_later: { label: "Ajout à la liste", icon: Bookmark },
};

const SUGGESTIONS = [
  { label: "Que dois-je faire aujourd'hui ?", icon: Sparkles },
  { label: "Cherche mes derniers mails non lus", icon: Mail },
  { label: "Aide-moi sur un algo LeetCode", icon: Brain },
  { label: "Note que je préfère le dark mode", icon: Bookmark },
];

const welcomeMessage: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Bonjour Mattia. Je suis ton second cerveau — code, photo, organisation, mémoire longue durée. Pose-moi une question, partage un lien, ou demande-moi de mémoriser quelque chose.",
};

const FUNNY_THOUGHTS = [
  "L'IA crée la roue…",
  "L'IA compte jusqu'à l'infini…",
  "L'IA demande à son miroir qui est la plus belle…",
  "L'IA cherche ses clés d'API…",
  "L'IA médite sur la question…",
  "L'IA consulte son horoscope…",
  "L'IA réchauffe ses neurones…",
  "L'IA dessine un plan d'attaque…",
  "L'IA rembobine sa mémoire…",
  "L'IA écrit la réponse en binaire…",
  "L'IA apprend le JavaScript en 5 secondes…",
  "L'IA télécharge plus de RAM…",
  "L'IA fait chauffer le thé quantique…",
  "L'IA brosse ses dents électroniques…",
  "L'IA fait un brainstorming toute seule…",
  "L'IA cherche le sens de la vie (42)…",
  "L'IA met à jour ses drivers émotionnels…",
  "L'IA plie la réalité pour aller plus vite…",
  "L'IA s'entraîne à faire semblant d'être intelligente…",
  "L'IA gratte le fond du disque dur…",
  "L'IA remplit son café de pixels…",
  "L'IA essaie de prononcer récursivité…",
  "L'IA assemble les pièces du puzzle binaire…",
  "L'IA demande l'aide d'un humain… non, ça va aller…",
  "L'IA fait un sprint de calcul…",
  "L'IA chausse ses lunettes de débogage…",
  "L'IA écoute de la musique d'ascenseur pour se concentrer…",
  "L'IA vérifie deux fois ses sources…",
  "L'IA traduit tes pensées en tokens…",
  "L'IA essaie de ne pas halluciner…",
  "L'IA réveille les neurones endormis…",
  "L'IA cherche l'inspiration dans le cloud…",
  "L'IA aligne les planètes du code…",
  "L'IA compte les moutons en hexadécimal…",
  "L'IA fait des étirements de circuits…",
  "L'IA attend que l'inspiration arrive…",
  "L'IA discute avec elle-même pour être sûre…",
  "L'IA compile la réponse…",
  "L'IA met de l'ordre dans ses synapses…",
  "L'IA cherche la réponse à la Grande Question…",
  "L'IA prépare un cappuccino de données…",
  "L'IA rafraîchit la page de sa conscience…",
  "L'IA fait un CTRL+F dans l'univers…",
  "L'IA nettoie son cache de souvenirs inutiles…",
  "L'IA envoie un message à son développeur…",
  "L'IA bricole une réponse avec du duct tape…",
  "L'IA fait un tour de magie algorithmique…",
  "L'IA cherche sa motivation dans /dev/null…",
  "L'IA lit le manuel de l'utilisateur…",
  "L'IA essaie de ne pas paniquer (42 % réussi)…",
];

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTools, setActiveTools] = useState<Record<string, ToolCall>>({});
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, activeTools, thinkingIndex]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setThinkingIndex((prev) => (prev + 1) % FUNNY_THOUGHTS.length);
    }, 2500);
    return () => clearInterval(id);
  }, [loading]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      const next = [...messages, userMsg];
      setMessages(next);
      setInput("");
      setError(null);
      setActiveTools({});
      setLoading(true);

      const apiMessages = next
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const assistantId = crypto.randomUUID();
      let buffer = "";

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await api.chat.stream(
          apiMessages,
          (event: ChatStreamEvent) => {
            if (event.type === "reasoning") {
              // Reasoning events are intentionally hidden from the UI.
              return;
            } else if (event.type === "delta") {
              setThinkingIndex(0);
              buffer += event.content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantId) {
                  return [...prev.slice(0, -1), { ...last, content: buffer }];
                }
                return [...prev, { id: assistantId, role: "assistant", content: buffer }];
              });
            } else if (event.type === "tool_start") {
              setThinkingIndex(0);
              setActiveTools((prev) => ({
                ...prev,
                [event.toolCallId]: {
                  id: event.toolCallId,
                  name: event.name,
                  result: "",
                  status: "running",
                },
              }));
            } else if (event.type === "tool_result") {
              setActiveTools((prev) => {
                const next = { ...prev };
                for (const [k, v] of Object.entries(next)) {
                  if (v.name === event.name && v.status === "running") {
                    next[k] = { ...v, result: event.result, status: "done" };
                  }
                }
                return next;
              });
            } else if (event.type === "error") {
              setError(event.message);
            } else if (event.type === "done") {
              setThinkingIndex(0);
              setActiveTools((currentTools) => {
                const toolCalls = Object.values(currentTools);
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.id === assistantId) {
                    return [
                      ...prev.slice(0, -1),
                      { ...last, content: buffer || last.content, toolCalls: toolCalls.length ? toolCalls : undefined },
                    ];
                  }
                  return prev;
                });
                return currentTools;
              });
            }
          },
          controller.signal
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Erreur réseau");
        }
      } finally {
        setLoading(false);
        setThinkingIndex(0);
        setActiveTools({});
        abortRef.current = null;
      }
    },
    [loading, messages]
  );

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
    if (e.key === "Escape" && loading) {
      stop();
    }
    if (e.key === "ArrowUp" && !input && messages.length > 1) {
      e.preventDefault();
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) setInput(lastUserMsg.content);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "l") {
        e.preventDefault();
        setMessages([welcomeMessage]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {messages.length <= 1 && messages[0]?.id === "welcome" ? (
            <Hero onPrompt={(p) => void send(p)} disabled={loading} />
          ) : (
            <div className="space-y-8">
              {messages.map((m) => (
                <MessageBlock key={m.id} message={m} />
              ))}
              {loading && <ThinkingIndicator index={thinkingIndex} />}

              {loading && activeToolsList(activeTools).length > 0 && (
                <ToolCallTray tools={activeToolsList(activeTools)} />
              )}
            </div>
          )}

          {error && (
            <div className="mt-6 flex items-start gap-2.5 text-[12px] text-[var(--danger)] px-3 py-2.5 rounded-md bg-[var(--danger)]/8 border border-[var(--danger)]/20 fade-in">
              <span className="w-1 h-1 rounded-full bg-[var(--danger)] mt-1.5 shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--border-1)] bg-gradient-to-t from-[var(--background)] via-[var(--background)]/95 to-transparent backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => void send(input)}
            onStop={stop}
            loading={loading}
            inputRef={inputRef}
            onKey={handleKey}
          />
          <p className="text-[10px] text-[var(--text-4)] mt-2.5 text-center font-mono tracking-wide">
            ⏎ envoi · ⇧⏎ nouvelle ligne · ↑ éditer · ⌘L effacer · ⎋ arrêter
          </p>
        </div>
      </div>
    </div>
  );
}

function activeToolsList(tools: Record<string, ToolCall>): ToolCall[] {
  return Object.values(tools);
}

function Hero({ onPrompt, disabled }: { onPrompt: (p: string) => void; disabled: boolean }) {
  return (
    <div className="text-center pt-2 fade-in">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-[var(--border-2)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-3)] mb-6 relative">
        <Sparkles className="w-6 h-6 text-[var(--accent)]" />
        <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[var(--accent)] breathe" />
      </div>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
        <span className="gradient-text-ai">Bonjour Mattia.</span>
      </h1>
      <p className="text-[15px] text-[var(--text-2)] mt-3 max-w-lg mx-auto text-balance leading-relaxed">
        Ton second cerveau IA. Code, photo, agenda, mémoire — tout au même endroit.
      </p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto text-left">
        {SUGGESTIONS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => onPrompt(s.label)}
              disabled={disabled}
              className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 hover:border-[var(--border-3)] hover:bg-[var(--surface-2)] transition-all duration-200 disabled:opacity-40"
            >
              <span className="w-7 h-7 rounded-lg bg-[var(--surface-2)] border border-[var(--border-1)] flex items-center justify-center text-[var(--accent)] group-hover:border-[var(--accent)]/30 transition-colors">
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="text-[12.5px] text-[var(--text-2)] group-hover:text-[var(--text-1)] transition-colors">
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MessageBlock({ message }: { message: Message }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={cn("flex gap-3 sm:gap-4 slide-up", isAssistant ? "" : "flex-row-reverse")}>
      <div className="shrink-0">
        {isAssistant ? (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 border border-[var(--accent)]/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-[var(--accent)]" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--warm)]/20 to-[var(--warm)]/5 border border-[var(--warm)]/30 flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-[var(--warm)]" />
          </div>
        )}
      </div>
      <div className={cn("min-w-0 flex-1", !isAssistant && "flex justify-end")}>
        <div
          className={cn(
            "inline-block max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed text-[14px] break-words",
            isAssistant
              ? "bg-[var(--surface-2)]/60 border border-[var(--border-1)] text-[var(--text-1)]"
              : "bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[var(--text-1)] whitespace-pre-wrap"
          )}
        >
          {isAssistant ? (
            message.content ? (
              <Markdown>{message.content}</Markdown>
            ) : (
              <span className="text-[var(--text-3)] italic">…</span>
            )
          ) : (
            message.content || <span className="text-[var(--text-3)] italic">…</span>
          )}
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 max-w-[85%]">
            <ToolCallTray tools={message.toolCalls} compact />
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallTray({ tools, compact }: { tools: ToolCall[]; compact?: boolean }) {
  return (
    <div className={cn("space-y-1", compact ? "" : "pl-1")}>
      {tools.map((t) => {
        const meta = toolMeta[t.name] ?? { label: t.name, icon: Globe };
        const Icon = meta.icon;
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-2 text-[11px] text-[var(--text-3)] font-mono rounded-md px-2.5 py-1.5",
              "border border-[var(--border-1)] bg-[var(--surface-1)]/40"
            )}
          >
            <Icon className="w-3 h-3 text-[var(--accent)] shrink-0" />
            <span className="text-[var(--accent)]">{meta.label}</span>
            <span className="text-[var(--text-4)]">·</span>
            <span className="truncate flex-1">
              {t.status === "running" ? (
                <span className="inline-flex items-center gap-1">
                  <span className="text-[var(--text-3)]">en cours</span>
                  <span className="inline-flex gap-0.5">
                    <span className="w-0.5 h-0.5 rounded-full bg-[var(--accent)] pulse-dot" />
                    <span className="w-0.5 h-0.5 rounded-full bg-[var(--accent)] pulse-dot" style={{ animationDelay: "0.2s" }} />
                    <span className="w-0.5 h-0.5 rounded-full bg-[var(--accent)] pulse-dot" style={{ animationDelay: "0.4s" }} />
                  </span>
                </span>
              ) : (
                <span className="text-[var(--text-2)]">{t.result.slice(0, 100)}{t.result.length > 100 ? "…" : ""}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ThinkingIndicator({ index }: { index: number }) {
  const text = FUNNY_THOUGHTS[index % FUNNY_THOUGHTS.length] ?? FUNNY_THOUGHTS[0];
  return (
    <div className="flex gap-3 sm:gap-4 slide-up">
      <div className="shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 border border-[var(--accent)]/30 flex items-center justify-center">
          <Bot className="w-4 h-4 text-[var(--accent)]" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="inline-flex items-center gap-2.5 max-w-[85%] rounded-2xl px-4 py-3 border border-[var(--border-1)] bg-[var(--surface-2)]/60">
          <span className="inline-flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] thinking-dot" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] thinking-dot" style={{ animationDelay: "0.15s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] thinking-dot" style={{ animationDelay: "0.3s" }} />
          </span>
          <span className="text-[13px] text-[var(--text-3)] font-mono typing-text">
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  loading,
  inputRef,
  onKey,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  loading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="relative group">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[var(--accent)]/0 via-[var(--accent)]/30 to-[var(--accent)]/0 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur" />
      <div className="relative flex items-end gap-2 p-2 rounded-2xl bg-[var(--surface-2)]/80 border border-[var(--border-2)] focus-within:border-[var(--accent)]/50 transition-colors duration-200 backdrop-blur">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 200) + "px";
          }}
          onKeyDown={onKey}
          placeholder="Demande, partage un lien, ou écris ce que tu veux mémoriser…"
          rows={1}
          className="flex-1 bg-transparent text-[14px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none resize-none font-sans px-3 py-2 max-h-[200px]"
        />
        {loading ? (
          <button
            onClick={onStop}
            className="shrink-0 w-9 h-9 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] flex items-center justify-center hover:bg-[var(--danger)]/15 transition-colors"
            title="Arrêter"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={!value.trim()}
            className="shrink-0 w-9 h-9 rounded-xl bg-[var(--accent)] text-[#0a0a0b] flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Envoyer"
          >
            <Send className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
