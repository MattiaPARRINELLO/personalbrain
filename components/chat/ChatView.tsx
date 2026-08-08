"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import { api, type ChatStreamEvent } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/Markdown";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useChatContext } from "@/lib/chat-context";
import { useToast } from "@/components/ui/Toast";
import type { Message, ToolCall } from "@/components/chat/types";
import {
  SUGGESTIONS,
  FUNNY_THOUGHTS,
  welcomeMessage,
  generateId,
  generateTitle,
  formatTime,
  activeToolsList,
  toolMeta,
} from "@/components/chat/chat-data";
import { MessageBlock, ToolCallTray, ThinkingIndicator } from "@/components/chat/MessageBlocks";

function Hero({ onPrompt, disabled }: { onPrompt: (p: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="-mx-6 sm:-mx-8 -mt-6 sm:-mt-16 relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[200px] h-[200px] sm:w-[500px] sm:h-[500px] rounded-full bg-[var(--accent)]/8 blur-[60px] sm:blur-[100px] animate-breathe" />
        </div>

        {/* Outer ring — hidden on mobile */}
        <div className="hidden sm:block absolute w-[420px] h-[420px] animate-orbit-ring pointer-events-none">
          <div className="absolute inset-0 rounded-full border border-[var(--accent)]/15" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_rgba(165,180,252,0.6)]" />
          <div className="absolute bottom-[15%] right-[10%] w-1.5 h-1.5 rounded-full bg-[var(--accent)]/40" />
        </div>

        {/* Middle ring — hidden on mobile */}
        <div className="hidden sm:block absolute w-[320px] h-[320px] animate-orbit-ring-reverse pointer-events-none">
          <div className="absolute inset-0 rounded-full border border-[var(--accent-cool)]/15" />
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--accent-cool)] shadow-[0_0_6px_rgba(122,162,247,0.5)]" />
        </div>

        {/* Inner ring — hidden on mobile */}
        <div className="hidden sm:block absolute w-[220px] h-[220px] animate-orbit-ring-slow pointer-events-none">
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
            className="w-full max-w-[140px] sm:max-w-[500px] h-auto object-contain drop-shadow-[0_0_20px_rgba(165,180,252,0.25)] sm:drop-shadow-[0_0_40px_rgba(165,180,252,0.35)]"
          />
        </div>
      </div>
      <h1 className="text-xl sm:text-6xl font-black tracking-[0.12em] uppercase text-[var(--text-1)] mb-1 sm:mb-2 font-mono">
        BACKSTAGE
      </h1>
      <p className="text-[11px] sm:text-[14px] text-[var(--text-2)] max-w-md leading-relaxed mb-4 sm:mb-8 font-mono tracking-wide">
        Ton espace de contrôle personnel.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
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

interface ChatViewProps {
  sessionId?: string;
  resetSignal?: number;
  onSessionChange?: (sessionId: string) => void;
}

export function ChatView({ sessionId: externalSessionId, resetSignal = 0, onSessionChange }: ChatViewProps = {}) {
  const [messages, setMessages] = useState<Message[]>(() =>
    typeof window !== "undefined"
      ? [welcomeMessage]
      : [welcomeMessage]
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionCards, setActionCards] = useState<{ id: string; toolName: string; result: string; timestamp: string }[]>([]);
  const [thinkingIndex, setThinkingIndex] = useState(() => Math.floor(Math.random() * FUNNY_THOUGHTS.length));
  const chatCtx = useChatContext();
  const toast = useToast();
  const activeToolsRef = useRef<Record<string, ToolCall>>({});
  const [, forceRender] = useState(0);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingActive, setStreamingActive] = useState(false);
  const streamingActiveRef = useRef(false);
  const [sessionId, setSessionId] = useState<string>(() => generateId());
  const [sessionTitle, setSessionTitle] = useState<string>("");

  const abortRef = useRef<(() => void) | null>(null);
  const loadSeqRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTitleRef = useRef(false);
  const prevExternalSessionIdRef = useRef<string>("");
  const prevSessionIdRef = useRef(sessionId);

  // Consentement IA : rien n'est envoyé au provider tant que l'utilisateur
  // n'a pas accepté l'écran de consentement (voir /privacy).
  const [consent, setConsent] = useState<{ loaded: boolean; accepted: boolean }>({
    loaded: false,
    accepted: false,
  });

  useEffect(() => {
    let cancelled = false;
    import("@/app/actions/consent")
      .then(({ loadAiConsent }) => loadAiConsent())
      .then((state) => {
        if (!cancelled) setConsent({ loaded: true, accepted: state.aiConsent });
      })
      .catch(() => {
        if (!cancelled) setConsent({ loaded: true, accepted: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const acceptConsent = async () => {
    try {
      const { acceptAiConsent } = await import("@/app/actions/consent");
      await acceptAiConsent(true);
      setConsent({ loaded: true, accepted: true });
    } catch {
      setConsent({ loaded: true, accepted: false });
    }
  };

  function restoreMessages(raw: { id: string; role: "user" | "assistant"; content: string; timestamp: string; toolCalls?: { id: string; name: string; arguments?: string; result?: string; status?: string; duration?: number; resultCount?: number }[] }[]): Message[] {
    const restored: Message[] = raw.map((m) => ({
      ...m,
      toolCalls: m.toolCalls?.map((tc) => ({
        ...tc,
        status: (tc.status as ToolCall["status"]) || "success",
      })),
    }));
    return restored.length > 0 ? restored : [welcomeMessage];
  }

  useEffect(() => {
    // Abort du streaming en cours si le composant est démonté (navigation).
    return () => {
      if (abortRef.current) abortRef.current();
    };
  }, []);

  useEffect(() => {
    if (externalSessionId && externalSessionId !== prevExternalSessionIdRef.current) {
      prevExternalSessionIdRef.current = externalSessionId;
      // Garde anti-race : si l'utilisateur change rapidement de session, seule
      // la dernière demande de chargement doit appliquer son résultat.
      const seq = ++loadSeqRef.current;
      import("@/app/actions/chat-history").then(({ getChatHistory }) => {
        getChatHistory().then((history) => {
          if (seq !== loadSeqRef.current) return;
          const session = history.sessions.find((s) => s.id === externalSessionId);
          if (session) {
            setSessionId(session.id);
            setSessionTitle(session.title || "");
            hasTitleRef.current = true;
            setMessages(restoreMessages(session.messages));
            setInput("");
            setStreamingContent("");
            setStreamingActive(false);
            setLoading(false);
            setError(null);
            activeToolsRef.current = {};
            chatCtx.clearActiveTools();
          }
        });
      });
    }
  }, [externalSessionId]);

  useEffect(() => {
    if (resetSignal === 0) return;
    const newId = generateId();
    prevSessionIdRef.current = newId;
    // Reset complet de la conversation déclenché par une prop externe (resetSignal) :
    // c'est une synchronisation légitime avec un système externe (le parent ChatLayout).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionTitle("");
    hasTitleRef.current = false;
    setMessages([welcomeMessage]);
    setInput("");
    setStreamingContent("");
    setStreamingActive(false);
    setLoading(false);
    setError(null);
    activeToolsRef.current = {};
    chatCtx.clearActiveTools();
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

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
        setThinkingIndex(Math.floor(Math.random() * FUNNY_THOUGHTS.length));
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [loading, streamingActive]);

  const prevMessagesLenRef = useRef(messages.length);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const len = messages.length;
    const isNewMessage = len > prevMessagesLenRef.current;
    prevMessagesLenRef.current = len;
    if (isNewMessage) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      const threshold = 60;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      if (isNearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    }
  }, [messages, streamingContent]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      if (consent.loaded && !consent.accepted) {
        setError(
          "Accepte l'utilisation de l'IA pour envoyer des messages (bannière ci-dessus ou page Vie privée)."
        );
        return;
      }

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      if (!hasTitleRef.current) {
        import("@/app/actions/chat-history").then(({ generateConversationTitle }) => {
          generateConversationTitle(trimmed).then((title) => {
            setSessionTitle(title);
          });
        });
        const title = generateTitle(trimmed);
        setSessionTitle(title);
        hasTitleRef.current = true;
        prevExternalSessionIdRef.current = sessionId;
        if (onSessionChange && sessionId) onSessionChange(sessionId);
      }

      setInput("");
      setError(null);
      activeToolsRef.current = {};
      chatCtx.clearActiveTools();
      setStreamingContent("");
      setActionCards([]);
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

      // Le bouton Stop / Esc / reset / unmount appelle abortRef.current(),
      // ce qui annule le fetch SSE ET la requête IA côté serveur.
      const controller = new AbortController();
      abortRef.current = () => controller.abort();

      try {
        await api.chat.stream(
          apiMessages,
          (event: ChatStreamEvent) => {
            if (event.type === "delta") {
              buffer += event.content;
              setStreamingContent(buffer);
              if (!streamingActiveRef.current) {
                streamingActiveRef.current = true;
                setStreamingActive(true);
              }
            } else if (event.type === "tool_start") {
              activeToolsRef.current = {
                ...activeToolsRef.current,
                [event.toolCallId]: {
                  id: event.toolCallId,
                  name: event.name,
                  arguments: event.arguments,
                  status: "running",
                },
              };
              chatCtx.registerToolStart({ id: event.toolCallId, name: event.name, arguments: event.arguments });
              if (!streamingActiveRef.current) {
                forceRender((n) => n + 1);
              }
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
              if (!isError) {
                setActionCards((prev) => [
                  ...prev,
                  {
                    id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    toolName: event.name,
                    result: event.result,
                    timestamp: new Date().toISOString(),
                  },
                ]);
              }
              forceRender((n) => n + 1);
            } else if (event.type === "error") {
              setError(event.message);
            } else if (event.type === "memory_facts") {
              const count = event.facts.length;
              if (count > 0) {
                toast.show({
                  message: `🧠 ${count} fait${count > 1 ? "s" : ""} mémorisé${count > 1 ? "s" : ""}`,
                  tone: "info",
                  duration: 3000,
                });
              }
            } else if (event.type === "done") {
              const content = buffer || event.content || "";
              const toolCalls = Object.values(activeToolsRef.current).filter(
                (t) => t.status === "success" || t.status === "error"
              ) as ToolCall[];
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === "assistant") {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined },
                  ];
                }
                return [
                  ...prev,
                  {
                    id: generateId(),
                    role: "assistant",
                    content,
                    timestamp: new Date().toISOString(),
                    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                  },
                ];
              });
              activeToolsRef.current = {};
              buffer = "";
              setStreamingContent("");
              streamingActiveRef.current = false;
              setStreamingActive(false);
              setLoading(false);

              if (hasTitleRef.current) {
                const firstUserMsg = messages.find((m) => m.role === "user");
                if (firstUserMsg && firstUserMsg.content) {
                  import("@/app/actions/chat-history").then(({ generateConversationTitle }) => {
                    const fullText = firstUserMsg.content + "\n" + content;
                    generateConversationTitle(fullText).then((aiTitle) => {
                      if (aiTitle && aiTitle.length > 3) {
                        setSessionTitle(aiTitle);
                      }
                    });
                  });
                }
              }
            }
          },
          controller.signal
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Erreur réseau");
        }
      } finally {
        abortRef.current = null;
        setLoading(false);
        streamingActiveRef.current = false;
        setStreamingActive(false);
        setStreamingContent("");
      }
    },
    [loading, messages, sessionId, onSessionChange, chatCtx, consent]
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setLoading(false);
    streamingActiveRef.current = false;
    setStreamingActive(false);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Sur écran tactile (pas de clavier physique), Entrée envoie directement ;
    // Shift+Entrée fait une nouvelle ligne. Sur desktop, Ctrl/Cmd+Entrée envoie.
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || (coarsePointer && !e.shiftKey))) {
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

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {consent.loaded && !consent.accepted && (
        <div className="shrink-0 px-4 py-3 border-b border-[var(--border-1)] bg-[var(--surface-2)]/80 backdrop-blur fade-in">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[var(--text-1)]">
                Tes messages seront envoyés à une IA
              </p>
              <p className="text-[11px] text-[var(--text-3)] mt-0.5 leading-relaxed">
                Ils servent uniquement à te répondre, jamais à entraîner un modèle.
                Tu peux tout exporter ou tout supprimer à tout moment.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/privacy"
                className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors duration-200"
              >
                Vie privée
              </a>
              <button
                onClick={() => void acceptConsent()}
                className="px-3.5 py-2 rounded-lg bg-[var(--accent)] text-[#0a0a0b] font-medium text-[12px] hover:brightness-110 active:brightness-95 transition-all duration-200"
              >
                J&apos;accepte
              </button>
            </div>
          </div>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {messages.length <= 1 && messages[0]?.id === "welcome" ? (
            <Hero onPrompt={(p) => void send(p)} disabled={loading} />
          ) : (
            <div className="space-y-6 chat-stagger">
              {messages.map((m) => {
                return (
                  <div key={m.id}>
                    <MessageBlock message={m} />
                  </div>
                );
              })}
              {actionCards.length > 0 && !streamingActive && (
                <div className="flex flex-col items-center gap-1.5 fade-in-up">
                  {actionCards.map((ac) => (
                    <div key={ac.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-2)] bg-[var(--surface-2)]/80 text-[11px] font-mono">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        ac.toolName === "add_reminder" || ac.toolName === "update_reminder"
                          ? "bg-[var(--warm)]"
                          : ac.toolName === "add_watch_later"
                          ? "bg-[var(--accent-cool)]"
                          : "bg-[var(--success)]"
                      )} />
                      <span className="text-[var(--text-3)] uppercase tracking-wider">{toolMeta[ac.toolName]?.label || ac.toolName}</span>
                      <span className="text-[var(--text-2)] max-w-[360px] truncate">{ac.result}</span>
                      <span className="text-[var(--text-4)]">{formatTime(ac.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
              {streamingActive && streamingContent && (
                <div key="streaming" className="flex justify-start scale-in">
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
              {loading && !streamingActive && (activeToolsList(chatCtx.activeTools).length > 0 ? (
                <div key="loading-tools" className="fade-in-up">
                  <div className="pl-9">
                    <ToolCallTray tools={activeToolsList(chatCtx.activeTools)} />
                  </div>
                </div>
              ) : (
                <div key="loading-thinking" className="fade-in-up">
                  <ThinkingIndicator index={thinkingIndex} />
                </div>
              ))}
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
          <ChatComposer
            value={input}
            onChange={setInput}
            onSubmit={() => void send(input)}
            onStop={stop}
            loading={loading}
            inputRef={inputRef}
            onKey={handleKey}
          />
          <p className="hidden sm:block text-[10px] text-[var(--text-4)] mt-2.5 text-center font-mono tracking-wide">
            Ctrl+Enter envoi · Shift+Enter nouvelle ligne · ↑ éditer · Ctrl+L effacer · Esc arrêter
          </p>
        </div>
      </div>
    </div>
  );
}
