"use client";

import { useCallback, useState } from "react";
import { ChatView } from "@/components/chat/ChatView";
import { SessionSidebar } from "@/components/chat/SessionSidebar";
import { ContextPanel } from "@/components/layout/ContextPanel";
import { ChatProvider } from "@/lib/chat-context";

export function ChatLayout() {
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [sessionKey, setSessionKey] = useState(0);

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
      setSessionKey((k) => k + 1);
    },
    []
  );

  const handleNewSession = useCallback(() => {
    setActiveSessionId("");
    setSessionKey((k) => k + 1);
  }, []);

  return (
    <ChatProvider>
      <div className="flex-1 min-w-0 flex h-full">
        <SessionSidebar
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
        />
        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
          <ChatView
            key={sessionKey}
            sessionId={activeSessionId}
            onSessionChange={setActiveSessionId}
          />
        </div>
        <ContextPanel />
      </div>
    </ChatProvider>
  );
}
