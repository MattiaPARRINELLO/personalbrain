"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ContextTool = {
  id: string;
  name: string;
  arguments?: string;
  result?: string;
  status: "running" | "success" | "error";
  duration?: number;
  resultCount?: number;
  startedAt: number;
};

type ChatContextValue = {
  activeTools: Record<string, ContextTool>;
  registerToolStart: (tool: Omit<ContextTool, "startedAt" | "status"> & { status?: ContextTool["status"] }) => void;
  registerToolResult: (name: string, result: string, isError: boolean, duration?: number) => void;
  clearActiveTools: () => void;
  lastFinishedTool: ContextTool | null;
  dismissLastFinishedTool: () => void;
  streamingActive: boolean;
  setStreamingActive: (v: boolean) => void;
  busy: boolean;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeTools, setActiveTools] = useState<Record<string, ContextTool>>({});
  const [streamingActive, setStreamingActive] = useState(false);
  const [lastFinishedTool, setLastFinishedTool] = useState<ContextTool | null>(null);

  const registerToolStart = useCallback<ChatContextValue["registerToolStart"]>((tool) => {
    setActiveTools((prev) => ({
      ...prev,
      [tool.id]: {
        ...tool,
        status: tool.status ?? "running",
        startedAt: Date.now(),
      },
    }));
  }, []);

  const registerToolResult = useCallback<ChatContextValue["registerToolResult"]>(
    (name, result, isError, duration) => {
      let finished: ContextTool | null = null;
      setActiveTools((prev) => {
        const key = Object.keys(prev).find((k) => prev[k].name === name);
        if (!key) return prev;
        const existing = prev[key];
        const updated: ContextTool = {
          ...existing,
          result,
          status: isError ? "error" : "success",
          duration: duration ?? existing.duration,
          resultCount: result ? result.split("\n").filter(Boolean).length || 1 : 1,
        };
        finished = updated;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (finished) {
        setLastFinishedTool(finished);
      }
    },
    []
  );

  const clearActiveTools = useCallback(() => {
    setActiveTools({});
  }, []);

  const dismissLastFinishedTool = useCallback(() => {
    setLastFinishedTool(null);
  }, []);

  const busy = useMemo(
    () => streamingActive || Object.keys(activeTools).length > 0,
    [streamingActive, activeTools]
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      activeTools,
      registerToolStart,
      registerToolResult,
      clearActiveTools,
      lastFinishedTool,
      dismissLastFinishedTool,
      streamingActive,
      setStreamingActive,
      busy,
    }),
    [
      activeTools,
      registerToolStart,
      registerToolResult,
      clearActiveTools,
      lastFinishedTool,
      dismissLastFinishedTool,
      streamingActive,
      busy,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    return {
      activeTools: {},
      registerToolStart: () => {},
      registerToolResult: () => {},
      clearActiveTools: () => {},
      lastFinishedTool: null,
      dismissLastFinishedTool: () => {},
      streamingActive: false,
      setStreamingActive: () => {},
      busy: false,
    };
  }
  return ctx;
}
