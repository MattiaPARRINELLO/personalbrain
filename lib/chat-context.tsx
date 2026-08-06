"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

  // Ref miroir : les mutations d'outils ne doivent PAS faire de side-effect
  // dans l'updater de setState (fonction censée être pure en React concurrent).
  // On calcule l'état suivant à partir du ref, puis on publie via setState.
  const activeToolsRef = useRef<Record<string, ContextTool>>({});
  useEffect(() => {
    activeToolsRef.current = activeTools;
  }, [activeTools]);

  const registerToolStart = useCallback<ChatContextValue["registerToolStart"]>((tool) => {
    const next: Record<string, ContextTool> = {
      ...activeToolsRef.current,
      [tool.id]: {
        ...tool,
        status: tool.status ?? "running",
        startedAt: Date.now(),
      },
    };
    activeToolsRef.current = next;
    setActiveTools(next);
  }, []);

  const registerToolResult = useCallback<ChatContextValue["registerToolResult"]>(
    (name, result, isError, duration) => {
      const prev = activeToolsRef.current;
      const key = Object.keys(prev).find((k) => prev[k].name === name);
      if (!key) return;
      const existing = prev[key];
      const updated: ContextTool = {
        ...existing,
        result,
        status: isError ? "error" : "success",
        duration: duration ?? existing.duration,
        resultCount: result ? result.split("\n").filter(Boolean).length || 1 : 1,
      };
      const next = { ...prev };
      delete next[key];
      activeToolsRef.current = next;
      setActiveTools(next);
      setLastFinishedTool(updated);
    },
    []
  );

  const clearActiveTools = useCallback(() => {
    activeToolsRef.current = {};
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
