"use client";

export function RetryButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border-2)] text-[var(--text-2)] text-[11px] font-mono uppercase tracking-[0.14em] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors duration-200 active:scale-[0.98]"
    >
      Réessayer
    </button>
  );
}
