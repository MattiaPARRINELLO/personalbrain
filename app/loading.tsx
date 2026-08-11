// Chargement global pendant les navigations : affiche un état de transition
// léger au lieu d'un écran vide (les pages métier ont leurs propres skeletons).
export default function Loading() {
  return (
    <div className="flex-1 min-w-0 h-full flex items-center justify-center bg-[var(--background)]">
      <div className="flex items-center gap-2 text-[var(--text-3)]">
        <span className="w-4 h-4 rounded-full border-2 border-[var(--accent)] border-r-transparent animate-spin" />
        <span className="text-[11px] font-mono tracking-wide">Chargement…</span>
      </div>
    </div>
  );
}
