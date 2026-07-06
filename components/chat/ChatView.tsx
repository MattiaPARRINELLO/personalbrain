"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send,
  Sparkles,
  Globe,
  Mail,
  SendHorizontal,
  CalendarPlus,
  Brain,
  Bookmark,
  Bell,
  Square,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AtSign,
  Plus,
} from "lucide-react";
import { api, type ChatStreamEvent } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/Markdown";
import { VoiceInput } from "@/components/chat/VoiceInput";
import { useChatContext } from "@/lib/chat-context";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
};

type ToolCall = {
  id: string;
  name: string;
  arguments?: string;
  result?: string;
  status: "running" | "success" | "error";
  duration?: number;
  resultCount?: number;
};

const toolMeta: Record<string, { label: string; icon: typeof Globe }> = {
  web_search: { label: "Recherche web", icon: Globe },
  fetch_and_search_emails: { label: "Consultation Gmail", icon: Mail },
  send_email_response: { label: "Envoi email", icon: SendHorizontal },
  create_calendar_event: { label: "Création calendrier", icon: CalendarPlus },
  add_memory_fact: { label: "Mémoire", icon: Brain },
  add_reminder: { label: "Rappel", icon: Bell },
  add_watch_later: { label: "Ajout à la liste", icon: Bookmark },
  search_calendar_events: { label: "Calendrier", icon: CalendarPlus },
  lookup_concerts: { label: "Concerts", icon: Globe },
  triage_emails: { label: "Tri emails", icon: Mail },
  fetch_page_meta: { label: "Aperçu lien", icon: Globe },
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
  timestamp: new Date().toISOString(),
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

const TITLE_MAX_LENGTH = 50;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= TITLE_MAX_LENGTH) return cleaned;
  return cleaned.slice(0, TITLE_MAX_LENGTH).replace(/\s\S*$/, "") + "…";
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

interface ChatViewProps {
  sessionId?: string;
  onSessionChange?: (sessionId: string) => void;
}

export function ChatView({ sessionId: externalSessionId, onSessionChange }: ChatViewProps = {}) {
  const [messages, setMessages] = useState<Message[]>(() =>
    typeof window !== "undefined"
      ? [welcomeMessage]
      : [welcomeMessage]
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const chatCtx = useChatContext();
  const activeToolsRef = useRef<Record<string, ToolCall>>({});
  const [, forceRender] = useState(0);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingActive, setStreamingActive] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTitleRef = useRef(false);

  useEffect(() => {
    if (externalSessionId) return;
    import("@/app/actions/chat-history").then(({ getChatHistory }) => {
      getChatHistory().then((history) => {
        const sessions = history.sessions;
        if (sessions.length > 0) {
          const last = sessions[sessions.length - 1];
          setSessionId(last.id);
          setSessionTitle(last.title || "");
          hasTitleRef.current = true;
          const restored: Message[] = last.messages.map((m) => ({
            ...m,
            toolCalls: m.toolCalls?.map((tc) => ({
              ...tc,
              status: (tc.status as ToolCall["status"]) || "success",
            })),
          }));
          setMessages(restored.length > 0 ? restored : [welcomeMessage]);
        } else {
          const newId = generateId();
          setSessionId(newId);
        }
      });
    });
  }, [externalSessionId]);

  const saveSession = useCallback(() => {
    if (!sessionId) return;
    const filtered = messages.filter((m) => m.id !== "welcome");
    if (filtered.length === 0) return;
    const title = sessionTitle || (filtered[0]?.role === "user" ? generateTitle(filtered[0].content) : "Nouvelle conversation");
    import("@/app/actions/chat-history").then(({ saveChatSession }) => {
      saveChatSession({
        id: sessionId,
        title,
        messages: filtered.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          toolCalls: m.toolCalls?.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments || "",
            result: tc.result,
            status: tc.status,
            duration: tc.duration,
            resultCount: tc.resultCount,
          })),
        })),
        createdAt: filtered[0]?.timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  }, [messages, sessionId, sessionTitle]);

  useEffect(() => {
    if (!sessionId || messages.length <= 1 || messages[0]?.id === "welcome") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveSession, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, sessionId, saveSession]);

  useEffect(() => {
    if (loading && streamingActive) {
      const interval = setInterval(() => {
        setThinkingIndex((prev) => (prev + 1) % FUNNY_THOUGHTS.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [loading, streamingActive]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      if (!hasTitleRef.current) {
        const title = generateTitle(trimmed);
        setSessionTitle(title);
        hasTitleRef.current = true;
        if (onSessionChange && sessionId) onSessionChange(sessionId);
      }

      setInput("");
      setError(null);
      activeToolsRef.current = {};
      chatCtx.clearActiveTools();
      setStreamingContent("");
      setLoading(true);
      setStreamingActive(false);

      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg];
      setMessages(next);

      const apiMessages = next
        .filter((m) => m.role !== "assistant" || m.content)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const startTime = Date.now();
      let buffer = "";

      try {
        await api.chat.stream(
          apiMessages,
          (event: ChatStreamEvent) => {
            if (event.type === "delta") {
              buffer += event.content;
              setStreamingContent(buffer);
              setStreamingActive(true);
            } else if (event.type === "tool_start") {
              setStreamingActive(false);
              activeToolsRef.current = {
                ...activeToolsRef.current,
                [event.toolCallId]: {
                  id: event.toolCallId,
                  name: event.name,
                  arguments: event.arguments,
                  status: "running",
                },
              };
              chatCtx.registerToolStart({
                id: event.toolCallId,
                name: event.name,
                arguments: event.arguments,
              });
              forceRender((n) => n + 1);
            } else if (event.type === "tool_result") {
              const toolEnd = Date.now();
              const key = Object.keys(activeToolsRef.current).find(
                (k) => activeToolsRef.current[k].name === event.name
              );
              const existing = key ? activeToolsRef.current[key] : null;
              const duration = (toolEnd - startTime) / 1000;
              const resultCount = event.result
                ? event.result.split("\n").filter(Boolean).length
                : 0;
              const isError = event.result.includes("Erreur");
              if (existing) {
                activeToolsRef.current = {
                  ...activeToolsRef.current,
                  [key!]: {
                    ...existing,
                    result: event.result,
                    status: isError ? "error" : "success",
                    duration,
                    resultCount: resultCount || 1,
                  },
                };
                if (key) delete activeToolsRef.current[key];
              }
              chatCtx.registerToolResult(event.name, event.result, isError, duration);
              forceRender((n) => n + 1);
            } else if (event.type === "error") {
              setError(event.message);
            } else if (event.type === "done") {
              if (buffer) {
                const toolCalls = Object.values(activeToolsRef.current).filter(
                  (t) => t.status === "success" || t.status === "error"
                ) as ToolCall[];
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === "assistant") {
                    return [
                      ...prev.slice(0, -1),
                      { ...last, content: buffer, toolCalls: toolCalls.length > 0 ? toolCalls : undefined },
                    ];
                  }
                  return [
                    ...prev,
                    {
                      id: generateId(),
                      role: "assistant",
                      content: buffer,
                      timestamp: new Date().toISOString(),
                      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                    },
                  ];
                });
                activeToolsRef.current = {};
              }
              buffer = "";
              setStreamingContent("");
              setStreamingActive(false);
              setLoading(false);
            }
          },
          abortRef.current ? undefined : undefined
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Erreur réseau");
        }
      } finally {
        setLoading(false);
        setStreamingActive(false);
        setStreamingContent("");
      }
    },
    [loading, messages, sessionId, onSessionChange, chatCtx]
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setLoading(false);
    setStreamingActive(false);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send(input);
    } else if (e.key === "ArrowUp" && !input && messages.length > 1) {
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
      if (e.key === "Escape" && loading) {
        stop();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loading, stop]);

  function activeToolsList(tools: Record<string, ToolCall>): ToolCall[] {
    return Object.values(tools);
  }

  function Hero({ onPrompt, disabled }: { onPrompt: (p: string) => void; disabled: boolean }) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="-mx-6 -mt-10 sm:-mx-8 sm:-mt-16 relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[400px] h-[400px] sm:w-[500px] sm:h-[500px] rounded-full bg-[var(--accent)]/8 blur-[100px] animate-breathe" />
          </div>

          {/* Outer ring */}
          <div className="absolute w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] animate-orbit-ring pointer-events-none">
            <div className="absolute inset-0 rounded-full border border-[var(--accent)]/15" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_rgba(165,180,252,0.6)]" />
            <div className="absolute bottom-[15%] right-[10%] w-1.5 h-1.5 rounded-full bg-[var(--accent)]/40" />
          </div>

          {/* Middle ring */}
          <div className="absolute w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] animate-orbit-ring-reverse pointer-events-none">
            <div className="absolute inset-0 rounded-full border border-[var(--accent-cool)]/15" />
            <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--accent-cool)] shadow-[0_0_6px_rgba(122,162,247,0.5)]" />
          </div>

          {/* Inner ring */}
          <div className="absolute w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] animate-orbit-ring-slow pointer-events-none">
            <div className="absolute inset-0 rounded-full border border-[var(--accent-warm)]/15" />
            <div className="absolute top-[10%] left-[20%] w-1 h-1 rounded-full bg-[var(--accent-warm)] shadow-[0_0_6px_rgba(212,163,115,0.5)]" />
          </div>

          <div className="relative">
            <Image
            src="/backstage-logo.png"
            alt="BACKSTAGE"
            width={500}
            height={500}
            priority
            className="w-full max-w-[450px] sm:max-w-[500px] h-auto object-contain drop-shadow-[0_0_40px_rgba(165,180,252,0.35)]"
          />
        </div>
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-[0.15em] uppercase text-[var(--text-1)] mb-2">
          BACKSTAGE
        </h1>
        <p className="text-[13px] sm:text-[14px] text-[var(--text-2)] max-w-md leading-relaxed mb-8 font-sans">
          Ton espace de contrôle personnel.
        </p>
        <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => void onPrompt(s.label)}
              disabled={disabled}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-[var(--text-2)] bg-[var(--surface-1)] border border-[var(--border-1)] rounded-lg hover:border-[var(--border-2)] hover:text-[var(--text-1)] transition-colors duration-200 text-left disabled:opacity-40"
            >
              <s.icon className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
              <span className="line-clamp-2">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function ActionChips({ message }: { message: Message }) {
    const isAssistant = message.role === "assistant" && message.id !== "welcome";
    if (!isAssistant || !message.content) return null;

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(message.content);
        setCopiedId(message.id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        // clipboard not available
      }
    };

    return (
      <div className="mt-2 flex flex-wrap gap-1.5 fade-in-action-chips">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] border border-[var(--border-1)] rounded hover:border-[var(--border-2)] hover:text-[var(--text-2)] transition-colors duration-200"
        >
          {copiedId === message.id ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
          {copiedId === message.id ? "Copié" : "Copier"}
        </button>
        <a
          href={`mailto:?body=${encodeURIComponent(message.content)}`}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] border border-[var(--border-1)] rounded hover:border-[var(--border-2)] hover:text-[var(--text-2)] transition-colors duration-200"
        >
          <Mail className="w-2.5 h-2.5" />
          Voir le mail
        </a>
        <button className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] border border-[var(--border-1)] rounded hover:border-[var(--accent-warm)]/40 hover:text-[var(--accent-warm)] transition-colors duration-200">
          <CalendarPlus className="w-2.5 h-2.5" />
          Ajouter au calendrier
        </button>
        <button className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] border border-[var(--border-1)] rounded hover:border-[var(--border-2)] hover:text-[var(--text-2)] transition-colors duration-200">
          <Bell className="w-2.5 h-2.5" />
          Créer un rappel
        </button>
      </div>
    );
  }

  function MessageBlock({ message }: { message: Message }) {
    const isUser = message.role === "user";
    const isWelcome = message.id === "welcome";

    if (isWelcome) {
      return (
        <div className="flex gap-3">
          <div className="shrink-0 w-6 h-6 rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] flex items-center justify-center mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cool)]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-4)]">ASSISTANT</span>
            </div>
            <div className="text-[14px] text-[var(--text-2)] leading-relaxed">
              <Markdown>{message.content}</Markdown>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "relative max-w-[85%] rounded-lg p-3.5",
            isUser
              ? "bg-[var(--surface-2)] border-r-2 border-[var(--accent-warm)]"
              : "bg-[var(--surface-1)] border-l-2 border-[var(--accent-cool)]"
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            {!isUser && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cool)] shrink-0" />
            )}
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-4)]">
              {isUser ? "TOI" : "ASSISTANT"}
            </span>
            <span className="text-[10px] font-mono text-[var(--text-3)]">
              · {formatTime(message.timestamp)}
            </span>
          </div>
          <div className={cn(
            "text-[14px] leading-relaxed",
            isUser ? "text-[var(--text-1)]" : "text-[var(--text-1)]"
          )}>
            <Markdown>{message.content}</Markdown>
          </div>
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {message.toolCalls.map((tc) => (
                <ToolCallResult key={tc.id} tool={tc} />
              ))}
            </div>
          )}
          <ActionChips message={message} />
        </div>
      </div>
    );
  }

  function ToolCallResult({ tool }: { tool: ToolCall }) {
    const [expanded, setExpanded] = useState(false);
    const isError = tool.status === "error";
    const isRunning = tool.status === "running";

    return (
      <div
        className={cn(
          "text-[11px] font-mono rounded border px-2.5 py-1.5",
          isRunning && "tool-scan",
          isRunning
            ? "border-[var(--ai-tool-call)]/40 bg-[var(--ai-tool-call)]/5"
            : isError
              ? "border-[var(--danger)]/30 bg-[var(--danger)]/5"
              : "border-[var(--accent-success)]/30 bg-[var(--accent-success)]/5"
        )}
      >
        {isRunning ? (
          <div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-tool-call)] animate-pulse" />
              <span className="text-[var(--ai-tool-call)]">
                ◈ {toolMeta[tool.name]?.label || tool.name}
              </span>
              <span className="text-[var(--text-4)]">running...</span>
            </div>
            <div className="mt-1.5 h-0.5 bg-[var(--border-1)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--ai-tool-call)]/50 rounded-full tool-progress-bar" />
            </div>
            {expanded && tool.arguments && (
              <div className="mt-2 text-[var(--text-3)] whitespace-pre-wrap break-all">
                {tool.arguments}
              </div>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-[var(--text-4)] hover:text-[var(--text-2)] transition-colors inline-flex items-center gap-0.5"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Masquer" : "Détails"}
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center gap-1.5 text-left"
            >
              <span className={isError ? "text-[var(--danger)]" : "text-[var(--accent-success)]"}>
                {isError ? "✗" : "✓"}
              </span>
              <span className="text-[var(--text-2)]">{toolMeta[tool.name]?.label || tool.name}</span>
              {tool.duration != null && (
                <span className="text-[var(--text-4)]">· {tool.duration.toFixed(1)}s</span>
              )}
              {tool.resultCount != null && (
                <span className="text-[var(--text-4)]">· {tool.resultCount} résultats</span>
              )}
              <span className="text-[var(--text-4)] ml-auto">
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </span>
            </button>
            {expanded && tool.result && (
              <div className={cn(
                "mt-2 pt-2 border-t border-[var(--border-1)] whitespace-pre-wrap break-all",
                isError ? "text-[var(--danger)]" : "text-[var(--text-3)]"
              )}>
                {tool.result}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function ToolCallTray({ tools }: { tools: ToolCall[] }) {
    return (
      <div className="flex gap-2 flex-wrap py-1">
        {tools.map((t) => (
          <ToolCallResult key={t.id} tool={t} />
        ))}
      </div>
    );
  }

  function ThinkingIndicator({ index }: { index: number }) {
    return (
      <div className="flex items-center gap-2.5 pl-9">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-thinking)] thinking-dot" />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-thinking)] thinking-dot" style={{ animationDelay: "0.15s" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-thinking)] thinking-dot" style={{ animationDelay: "0.3s" }} />
        </div>
        <span className="text-[11px] font-mono text-[var(--text-4)] italic">
          {FUNNY_THOUGHTS[index % FUNNY_THOUGHTS.length]}
        </span>
      </div>
    );
  }

  function Composer({
    value,
    onChange,
    onSubmit,
    onStop,
    loading: isLoading,
    inputRef: ref,
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
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showMentionMenu, setShowMentionMenu] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    };
    const handleDragLeave = () => setDragOver(false);
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onChange(value + ` [Fichier: ${files[0].name}]`);
      }
    };

    const insertMention = (mention: string) => {
      onChange(value + mention + " ");
      setShowMentionMenu(false);
      ref.current?.focus();
    };

    const handleFileUpload = () => {
      fileInputRef.current?.click();
    };

    return (
      <div className="relative group animate-input-glow rounded-2xl">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[var(--accent)]/0 via-[var(--accent)]/30 to-[var(--accent)]/0 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur" />
        <div
          className={cn(
            "relative flex items-end gap-2 p-2 rounded-2xl bg-[var(--surface-2)]/80 border transition-colors duration-200 backdrop-blur",
            dragOver
              ? "border-[var(--accent-cool)] bg-[var(--accent-cool)]/5"
              : "border-[var(--border-2)] focus-within:border-[var(--accent)]/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="relative">
            <button
              onClick={() => setShowMentionMenu(!showMentionMenu)}
              className="shrink-0 w-8 h-8 rounded-lg border border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-1)] hover:border-[var(--border-2)] flex items-center justify-center transition-colors duration-200"
              title="Mentionner un module (@gmail, @calendar, @memory)"
            >
              <AtSign className="w-3.5 h-3.5" />
            </button>
            {showMentionMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-[var(--border-2)] bg-[var(--surface-1)] shadow-lg shadow-black/40 p-1 z-50">
                {[
                  { label: "@gmail", desc: "Rechercher dans les mails" },
                  { label: "@calendar", desc: "Consulter le calendrier" },
                  { label: "@memory", desc: "Interroger la mémoire" },
                ].map((m) => (
                  <button
                    key={m.label}
                    onClick={() => insertMention(m.label)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors duration-150"
                  >
                    <span className="text-[13px] text-[var(--accent-cool)] font-mono">{m.label}</span>
                    <span className="block text-[11px] text-[var(--text-4)]">{m.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <VoiceInput
            onResult={(text) => onChange(value + text)}
            disabled={isLoading}
          />
          <button
            onClick={handleFileUpload}
            className="shrink-0 w-8 h-8 rounded-lg border border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-1)] hover:border-[var(--border-2)] flex items-center justify-center transition-colors duration-200"
            title="Uploader un fichier"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChange(value + ` [Fichier: ${file.name}]`);
              e.target.value = "";
            }}
          />

          <textarea
            ref={ref}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 200) + "px";
            }}
            onKeyDown={onKey}
            placeholder="Ctrl+Enter pour envoyer, Shift+Enter nouvelle ligne…"
            rows={1}
            className="flex-1 bg-transparent text-[14px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none resize-none font-sans px-3 py-2 max-h-[200px]"
          />
          {isLoading ? (
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
              title="Envoyer (Ctrl+Enter)"
            >
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
        {dragOver && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-[var(--surface-2)]/90 border-2 border-dashed border-[var(--accent-cool)] z-10">
            <span className="text-[12px] font-mono text-[var(--accent-cool)]">
              Déposer le fichier
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {messages.length <= 1 && messages[0]?.id === "welcome" ? (
            <Hero onPrompt={(p) => void send(p)} disabled={loading} />
          ) : (
            <div className="space-y-6 chat-stagger">
              {messages.map((m) => (
                <MessageBlock key={m.id} message={m} />
              ))}
              {streamingActive && streamingContent && (
                <div className="flex justify-start">
                  <div className="relative max-w-[85%] rounded-lg p-3.5 bg-[var(--surface-1)] border-l-2 border-[var(--accent-cool)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cool)] shrink-0" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-4)]">ASSISTANT</span>
                    </div>
                    <div className="text-[14px] leading-relaxed text-[var(--text-1)]">
                      <Markdown>{streamingContent}</Markdown>
                      <span className="blink-cursor">█</span>
                    </div>
                  </div>
                </div>
              )}
              {loading && !streamingActive && activeToolsList(activeToolsRef.current).length > 0 && (
                <div className="pl-9">
                  <ToolCallTray tools={activeToolsList(activeToolsRef.current)} />
                </div>
              )}
              {loading && !streamingActive && activeToolsList(activeToolsRef.current).length === 0 && (
                <ThinkingIndicator index={thinkingIndex} />
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
            Ctrl+Enter envoi · Shift+Enter nouvelle ligne · ↑ éditer · Ctrl+L effacer · Esc arrêter
          </p>
        </div>
      </div>
    </div>
  );
}
