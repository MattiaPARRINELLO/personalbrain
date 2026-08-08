import type { Metadata } from "next";
import { RetryButton } from "./RetryButton";

export const metadata: Metadata = {
  title: "Hors-ligne — BACKSTAGE",
};

export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--background)] px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-6 font-mono font-black tracking-tight text-[var(--accent)]">
          BACKSTAGE
        </div>
        <div className="w-12 h-px bg-[var(--border-2)] mx-auto mb-6" />
        <h1 className="text-sm font-mono font-semibold text-[var(--text-1)] mb-3">
          Hors-ligne
        </h1>
        <p className="text-[11px] font-mono text-[var(--text-3)] leading-relaxed">
          Les données en cache sont toujours accessibles.
          Reviens dès que la connexion est rétablie.
        </p>
        <RetryButton />
      </div>
    </div>
  );
}
