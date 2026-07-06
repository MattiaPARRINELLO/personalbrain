"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Check, X, Undo2, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "default" | "success" | "danger" | "info" | "warning";

export type ToastInput = {
  id?: string;
  message: string;
  tone?: ToastTone;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

type Toast = Required<Omit<ToastInput, "action">> & {
  action?: ToastInput["action"];
  enteredAt: number;
};

type ToastContextValue = {
  show: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  update: (id: string, patch: Partial<ToastInput>) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;
const newId = () => `t-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const update = useCallback<ToastContextValue["update"]>((id, patch) => {
    setToasts((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              ...(patch.message ? { message: patch.message } : {}),
              ...(patch.tone ? { tone: patch.tone } : {}),
              ...(patch.duration ? { duration: patch.duration } : {}),
              ...(patch.action !== undefined ? { action: patch.action } : {}),
            }
          : t
      )
    );
  }, []);

  const show = useCallback<ToastContextValue["show"]>((toast) => {
    const id = toast.id ?? newId();
    const next: Toast = {
      id,
      message: toast.message,
      tone: toast.tone ?? "default",
      duration: toast.duration ?? 4000,
      action: toast.action,
      enteredAt: Date.now(),
    };
    setToasts((prev) => {
      const existing = prev.find((t) => t.id === id);
      if (existing) {
        return prev.map((t) => (t.id === id ? next : t));
      }
      return [...prev, next];
    });
    return id;
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ show, dismiss, update }),
    [show, dismiss, update]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = toast.tone === "success" ? Check : toast.tone === "danger" || toast.tone === "warning" ? AlertTriangle : Info;
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto toast-slide-in flex items-center gap-3 px-3.5 py-2.5 rounded-xl border backdrop-blur min-w-[280px] max-w-[92vw]",
        toast.tone === "success" && "border-[var(--accent-success)]/40 bg-[var(--accent-success)]/10 text-[var(--text-1)]",
        toast.tone === "danger" && "border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--text-1)]",
        toast.tone === "warning" && "border-[var(--warm)]/40 bg-[var(--warm)]/10 text-[var(--text-1)]",
        toast.tone === "info" && "border-[var(--accent-cool)]/40 bg-[var(--accent-cool)]/10 text-[var(--text-1)]",
        toast.tone === "default" && "border-[var(--border-2)] bg-[var(--surface-2)]/90 text-[var(--text-1)]"
      )}
      style={{ animationFillMode: "both" }}
    >
      <Icon
        className={cn(
          "w-3.5 h-3.5 shrink-0",
          toast.tone === "success" && "text-[var(--accent-success)]",
          toast.tone === "danger" && "text-[var(--danger)]",
          toast.tone === "warning" && "text-[var(--warm)]",
          toast.tone === "info" && "text-[var(--accent-cool)]",
          toast.tone === "default" && "text-[var(--text-2)]"
        )}
      />
      <span className="text-[12.5px] leading-snug flex-1 min-w-0">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider text-[var(--accent-soft)] hover:bg-[var(--accent)]/15 transition-colors"
        >
          <Undo2 className="w-3 h-3" />
          {toast.action.label}
        </button>
      )}
      <button
        onClick={onDismiss}
        className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-colors"
        aria-label="Fermer"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: () => "",
      dismiss: () => {},
      update: () => {},
    };
  }
  return ctx;
}
