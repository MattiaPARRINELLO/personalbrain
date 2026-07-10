import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hors-ligne — BACKSTAGE",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-6 font-mono font-black tracking-tight text-[var(--accent)]">
          BACKSTAGE
        </div>
        <div className="w-12 h-px bg-[var(--border)] mx-auto mb-6" />
        <h1 className="text-sm font-mono font-semibold text-[var(--fg)] mb-3">
          Hors-ligne
        </h1>
        <p className="text-[11px] font-mono text-[var(--muted)] leading-relaxed">
          Les données en cache sont toujours accessibles.
          Reviens dès que la connexion est rétablie.
        </p>
      </div>
    </div>
  );
}
