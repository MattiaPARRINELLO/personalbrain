"use client";

import { useState, memo } from "react";
import {
  Check,
  Copy,
  Mail,
  CalendarPlus,
  Bell,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/Markdown";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { Message, ToolCall } from "@/components/chat/types";
import { formatTime, toolMeta, FUNNY_THOUGHTS } from "@/components/chat/chat-data";

function containsEmailContent(text: string) {
  return /@\w+\.\w+/.test(text) || /\b(email|mail|e-?mail|courriel|envoyer|écrire)\b/i.test(text);
}

function containsCalendarContent(text: string) {
  return /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/.test(text)
    || /\b(calend(?:er|ar|rier|rier)|agenda|rendez-?vous|meeting|réunion|event|rdv|séance|séminaire)\b/i.test(text)
    || /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i.test(text);
}

function containsReminderContent(text: string) {
  return /\b(rappel?|remind|todo|à faire|tâche|task|noter|mémoriser|pense à|n'oublie)\b/i.test(text);
}

function ActionChips({ message }: { message: Message }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const toast = useToast();
  const isAssistant = message.role === "assistant" && message.id !== "welcome";
  if (!isAssistant || !message.content) return null;

  const content = message.content;
  const showMail = containsEmailContent(content);
  const showCalendar = containsCalendarContent(content);
  const showReminder = containsReminderContent(content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleAddReminder = async () => {
    try {
      const { createReminder } = await import("@/app/actions/reminders");
      await createReminder({
        title: content.slice(0, 120),
        notes: content.slice(0, 2000),
        dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      toast.show({ message: "Rappel créé", tone: "success", duration: 2500 });
    } catch {
      toast.show({ message: "Impossible de créer le rappel", tone: "danger", duration: 3000 });
    }
  };

  const handleAddCalendar = async () => {
    try {
      const start = new Date(Date.now() + 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const res = await api.calendar.create({
        summary: content.slice(0, 80),
        start: start.toISOString(),
        end: end.toISOString(),
      });
      if (!res.success) throw new Error("Échec de l'ajout");
      toast.show({ message: "Événement ajouté au calendrier", tone: "success", duration: 2500 });
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : "Impossible d'ajouter au calendrier",
        tone: "danger",
        duration: 3000,
      });
    }
  };

  const btn =
    "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] border border-[var(--border-1)] rounded hover:border-[var(--border-2)] hover:text-[var(--text-2)] transition-colors duration-200";

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 fade-in-action-chips">
      <button onClick={handleCopy} className={btn}>
        {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copiedId === message.id ? "Copié" : "Copier"}
      </button>
      {showMail && (
        <a href={`mailto:?body=${encodeURIComponent(content)}`} className={btn}>
          <Mail className="w-3 h-3" />
          Voir le mail
        </a>
      )}
      {showCalendar && (
        <button onClick={() => void handleAddCalendar()} className={`${btn} hover:border-[var(--accent-warm)]/40 hover:text-[var(--accent-warm)]`}>
          <CalendarPlus className="w-3 h-3" />
          Ajouter au calendrier
        </button>
      )}
      {showReminder && (
        <button onClick={() => void handleAddReminder()} className={btn}>
          <Bell className="w-3 h-3" />
          Créer un rappel
        </button>
      )}
    </div>
  );
}

// Memoïsé : la saisie (setInput) re-rend ChatView à chaque frappe, mais les
// messages existants sont des références stables — on évite de re-parser tout
// le markdown de la conversation à chaque keypress.
export const MessageBlock = memo(function MessageBlock({ message }: { message: Message }) {
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
        <div className="text-[14px] leading-relaxed text-[var(--text-1)]">
          <Markdown>{message.content}</Markdown>
        </div>
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1.5 fade-in-up">
            {message.toolCalls.map((tc) => (
              <ToolCallResult key={tc.id} tool={tc} />
            ))}
          </div>
        )}
        <ActionChips message={message} />
      </div>
    </div>
  );
});

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

export function ToolCallTray({ tools }: { tools: ToolCall[] }) {
  return (
    <div className="flex gap-2 flex-wrap py-1">
      {tools.map((t) => (
        <ToolCallResult key={t.id} tool={t} />
      ))}
    </div>
  );
}

export function ThinkingIndicator({ index }: { index: number }) {
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
