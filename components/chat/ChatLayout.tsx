"use client";

import { useCallback, useState } from "react";
import { ChatView } from "@/components/chat/ChatView";
import { SessionSidebar } from "@/components/chat/SessionSidebar";
import { ContextPanel } from "@/components/layout/ContextPanel";
import { ChatProvider } from "@/lib/chat-context";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatLayout() {
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [resetSignal, setResetSignal] = useState(0);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);

  const handleSelectSession = useCallback(
    (session: {
      id: string;
      title: string;
      messages: {
        id: string;
        role: "user" | "assistant";
        content: string;
        timestamp: string;
        toolCalls?: {
          id: string;
          name: string;
          arguments?: string;
          result?: string;
          status: "running" | "success" | "error";
          duration?: number;
          resultCount?: number;
        }[];
      }[];
    }) => {
      setActiveSessionId(session.id);
      setMobileSessionsOpen(false);
    },
    []
  );

  const handleNewSession = useCallback(() => {
    setActiveSessionId("");
    setResetSignal((k) => k + 1);
    setMobileSessionsOpen(false);
  }, []);

  return (
    <ChatProvider>
      <div className="flex-1 min-w-0 flex h-full">
        <SessionSidebar
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          mobileOpen={mobileSessionsOpen}
          onMobileClose={() => setMobileSessionsOpen(false)}
        />

        {mobileSessionsOpen && (
          <div
            className="lg:hidden fixed inset-0 z-30 bg-[#000]/50"
            onClick={() => setMobileSessionsOpen(false)}
          />
        )}

        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 relative">
          <button
            onClick={() => setMobileSessionsOpen(true)}
            className="lg:hidden absolute top-2 left-2 z-10 w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Liste des conversations"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <ChatView
            sessionId={activeSessionId}
            resetSignal={resetSignal}
            onSessionChange={setActiveSessionId}
          />
        </div>
        <ContextPanel />
      </div>
    </ChatProvider>
  );
}
