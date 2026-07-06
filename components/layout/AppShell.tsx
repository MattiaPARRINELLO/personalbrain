"use client";

import { type ReactNode } from "react";
import { LeftNav, MobileTopBar, MobileBottomNav } from "./Chrome";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { KeyboardShortcuts } from "@/components/ui/KeyboardShortcuts";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { ToastProvider } from "@/components/ui/Toast";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="relative z-10 flex h-screen overflow-hidden bg-[var(--background)]">
        <LeftNav />
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <MobileTopBar />
          <main className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0 flex">{children}</div>
          </main>
          <MobileBottomNav />
        </div>
        <CommandPalette />
        <KeyboardShortcuts />
        <OfflineBanner />
      </div>
    </ToastProvider>
  );
}
