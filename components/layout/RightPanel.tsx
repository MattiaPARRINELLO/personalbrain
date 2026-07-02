"use client";

import { useState } from "react";
import { Settings2, X } from "lucide-react";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { GmailWidget } from "@/components/widgets/GmailWidget";
import { LeetCodeWidget } from "@/components/widgets/LeetCodeWidget";
import { cn } from "@/lib/utils";

type View = "all" | "calendar" | "gmail" | "leetcode";

export function RightPanel() {
  const [view, setView] = useState<View>("all");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden xl:flex flex-col shrink-0 h-full border-l border-[var(--border-1)] bg-[var(--surface-1)]/40 backdrop-blur transition-[width] duration-300 ease-out",
        collapsed ? "w-12" : "w-[340px]"
      )}
    >
      <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--border-1)]">
        {!collapsed && (
          <div className="flex items-center gap-1">
            <ViewSwitcher view={view} onChange={setView} />
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
          title={collapsed ? "Étendre" : "Réduire"}
        >
          {collapsed ? <Settings2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {(view === "all" || view === "calendar") && <CalendarWidget />}
          {(view === "all" || view === "gmail") && <GmailWidget />}
          {(view === "all" || view === "leetcode") && <LeetCodeWidget />}
        </div>
      )}
    </aside>
  );
}

function ViewSwitcher({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const tabs: { id: View; label: string }[] = [
    { id: "all", label: "Tout" },
    { id: "calendar", label: "Agenda" },
    { id: "gmail", label: "Inbox" },
    { id: "leetcode", label: "Code" },
  ];
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-1)]">
      {tabs.map((t) => {
        const active = view === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-medium font-mono uppercase tracking-wider transition-all duration-200",
              active
                ? "bg-[var(--surface-3)] text-[var(--text-1)] shadow-sm"
                : "text-[var(--text-3)] hover:text-[var(--text-1)]"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
