"use client";

import { type ReactNode } from "react";
import { LeftNav, MobileTopBar, MobileBottomNav } from "./Chrome";
import { RightPanel } from "./RightPanel";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { KeyboardShortcuts } from "@/components/ui/KeyboardShortcuts";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 flex h-screen overflow-hidden bg-[var(--background)]">
      <LeftNav />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <MobileTopBar />
        <main className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 flex">{children}</div>
          <RightPanel />
        </main>
        <MobileBottomNav />
      </div>
      <CommandPalette />
      <KeyboardShortcuts />
      <OfflineBanner />
    </div>
  );
}
