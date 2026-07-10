"use client";

import { useRef, useState } from "react";
import { Send, Square, Plus, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceInput } from "@/components/chat/VoiceInput";

export interface ChatComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  loading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  loading: isLoading,
  inputRef: ref,
  onKey,
}: ChatComposerProps) {
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
          placeholder="Envoyer un message…"
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
