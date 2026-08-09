"use client";

import { useState, memo } from "react";
import Image from "next/image";
import {
  Check,
  Copy,
  Mail,
  CalendarPlus,
  Bell,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/Markdown";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { Message, ToolCall } from "@/components/chat/types";
import { toolMeta, FUNNY_THOUGHTS } from "@/components/chat/chat-data";

export function AssistantAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] flex items-center justify-center overflow-hidden",
        size === "md" ? "w-7 h-7" : "w-6 h-6"
      )}
    >
      <Image
        src="/backstage-logo-simple.png"
        alt="BACKSTAGE"
        width={18}
        height={18}
        className={size === "md" ? "w-4 h-4 object-contain" : "w-3.5 h-3.5 object-contain"}
      />
    </div>
  );
}

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
    "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] rounded-lg transition-colors duration-200";

  return (
    <div className="mt-2.5 flex flex-wrap gap-1 fade-in-action-chips">
      <button onClick={handleCopy} className={btn}>
        {copiedId === message.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copiedId === message.id ? "Copié" : "Copier"}
      </button>
      {showMail && (
        <a href={`mailto:?body=${encodeURIComponent(content)}`} className={btn}>
          <Mail className="w-3.5 h-3.5" />
          Voir le mail
        </a>
      )}
      {showCalendar && (
        <button onClick={() => void handleAddCalendar()} className={cn(btn, "hover:text-[var(--accent-warm)]")}>
          <CalendarPlus className="w-3.5 h-3.5" />
          Ajouter au calendrier
        </button>
      )}
      {showReminder && (
        <button onClick={() => void handleAddReminder()} className={cn(btn, "hover:text-[var(--warm)]")}>
          <Bell className="w-3.5 h-3.5" />
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

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-[var(--surface-2)] px-4 py-2.5 text-[15px] leading-[1.6] text-[var(--text-1)] whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-[15px] leading-[1.75] text-[var(--text-1)]">
          <Markdown>{message.content}</Markdown>
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2.5 space-y-1.5 fade-in-up">
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
  const Icon = toolMeta[tool.name]?.icon ?? Sparkles;

  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-col items-stretch rounded-lg border px-2.5 py-1.5 text-[11px] font-mono",
        isRunning && "tool-scan",
        isRunning
          ? "border-[var(--ai-tool-call)]/40 bg-[var(--ai-tool-call)]/8 text-[var(--ai-tool-call)]"
          : isError
            ? "border-[var(--danger)]/30 bg-[var(--danger)]/8 text-[var(--danger)]"
            : "border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-2)]"
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 min-w-0 text-left"
      >
        {isRunning ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-tool-call)] animate-pulse shrink-0" />
        ) : (
          <Icon className="w-3 h-3 shrink-0" />
        )}
        <span className="truncate">{toolMeta[tool.name]?.label || tool.name}</span>
        {tool.duration != null && !isRunning && (
          <span className="text-[var(--text-4)]">· {tool.duration.toFixed(1)}s</span>
        )}
        {tool.resultCount != null && !isRunning && (
          <span className="text-[var(--text-4)]">· {tool.resultCount} résultats</span>
        )}
        {expanded ? <ChevronUp className="w-3 h-3 shrink-0 text-[var(--text-4)]" /> : <ChevronDown className="w-3 h-3 shrink-0 text-[var(--text-4)]" />}
      </button>
      {expanded && (
        <div
          className={cn(
            "mt-1.5 pt-1.5 border-t border-[var(--border-1)] whitespace-pre-wrap break-all text-[var(--text-3)]",
            isError && "text-[var(--danger)]"
          )}
        >
          {isRunning && tool.arguments ? tool.arguments : tool.result || tool.arguments || ""}
        </div>
      )}
    </div>
  );
}

export function ToolCallTray({ tools }: { tools: ToolCall[] }) {
  return (
    <div className="flex gap-2 flex-wrap py-0.5">
      {tools.map((t) => (
        <ToolCallResult key={t.id} tool={t} />
      ))}
    </div>
  );
}

export function ThinkingIndicator({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-thinking)] thinking-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-thinking)] thinking-dot" style={{ animationDelay: "0.15s" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-thinking)] thinking-dot" style={{ animationDelay: "0.3s" }} />
      </div>
      <span className="text-[11px] font-mono text-[var(--text-4)]">
        {FUNNY_THOUGHTS[index % FUNNY_THOUGHTS.length]}
      </span>
    </div>
  );
}
