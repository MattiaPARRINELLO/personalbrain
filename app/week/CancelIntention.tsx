"use client";

import { useState } from "react";
import { cancelIntention } from "@/app/actions/intentions";

export function CancelIntentionButton({ id }: { id: string }) {
  const [cancelled, setCancelled] = useState(false);

  return (
    <button
      onClick={async () => {
        try {
          await cancelIntention(id);
          setCancelled(true);
        } catch {
          // L'erreur est silencieuse : le bouton reste cliquable pour réessayer.
        }
      }}
      disabled={cancelled}
      className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-4)] hover:text-[var(--danger)] disabled:opacity-40 disabled:cursor-default transition-colors duration-200"
    >
      {cancelled ? "Annulée" : "Annuler"}
    </button>
  );
}
