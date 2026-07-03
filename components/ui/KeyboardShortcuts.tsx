"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const SHORTCUTS = [
  { keys: "g + c", label: "Console IA", href: "/" },
  { keys: "g + r", label: "Rappels", href: "/reminders" },
  { keys: "g + w", label: "À voir plus tard", href: "/watch-later" },
  { keys: "g + a", label: "Accréditations", href: "/accreditations" },
  { keys: "g + b", label: "Cerveau (mémoire)", href: "/brain" },
  { keys: "g + l", label: "Journal d'activité", href: "/activity" },
  { keys: "g + s", label: "Recherche unifiée", href: "/search" },
  { keys: "⌘K", label: "Palette de commandes" },
  { keys: "⌘L", label: "Effacer le chat" },
  { keys: "↑", label: "Éditer le dernier message" },
  { keys: "Esc", label: "Arrêter le streaming" },
  { keys: "?", label: "Aide / raccourcis" },
  { keys: "t", label: "Mode code/toggle modèle" },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }

      if (e.key === "g" && !isInput) {
        e.preventDefault();
        const handler = (e2: KeyboardEvent) => {
          window.removeEventListener("keydown", handler);
          switch (e2.key) {
            case "c": router.push("/"); break;
            case "r": router.push("/reminders"); break;
            case "w": router.push("/watch-later"); break;
            case "a": router.push("/accreditations"); break;
            case "b": router.push("/brain"); break;
            case "l": router.push("/activity"); break;
            case "s": router.push("/search"); break;
          }
        };
        window.addEventListener("keydown", handler);
        setTimeout(() => window.removeEventListener("keydown", handler), 1000);
      }
    },
    [router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[480px] max-w-[90vw] max-h-[80vh] overflow-y-auto rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[13px] font-semibold text-[var(--text-1)] mb-1">Raccourcis clavier</h2>
        <p className="text-[11px] text-[var(--text-3)] mb-5 font-mono">Appuie sur ? pour réouvrir</p>
        <div className="space-y-1">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            >
              <span className="text-[12px] text-[var(--text-2)]">{s.label}</span>
              <kbd
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-mono rounded border bg-[var(--surface-3)] border-[var(--border-2)] text-[var(--text-1)]",
                  s.keys.length > 3 && "tracking-wider"
                )}
              >
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
