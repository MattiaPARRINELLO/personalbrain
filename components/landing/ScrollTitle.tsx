"use client";

import { useEffect, useRef } from "react";

const SECTIONS = [
  { id: "journee", title: "BACKSTAGE · une journée" },
  { id: "produit", title: "BACKSTAGE · le produit" },
  { id: "modules", title: "BACKSTAGE · les modules" },
  { id: "vie-privee", title: "BACKSTAGE · vie privée" },
] as const;

const DEFAULT_TITLE = "BACKSTAGE · Second Brain IA";

/**
 * Fait défiler le titre de l'onglet au fil des sections de la landing.
 * Les sections sont observées en ordre ; la plus haute dans le viewport gagne.
 */
export function ScrollTitle() {
  const current = useRef(DEFAULT_TITLE);

  useEffect(() => {
    const sections = SECTIONS.map((s) => ({
      ...s,
      el: document.getElementById(s.id),
    })).filter((s) => s.el);

    if (sections.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const update = () => {
      let winner = DEFAULT_TITLE;
      let winnerTop = -Infinity;
      // On garde la section la PLUS RÉCEMMENT franchie : le top le plus grand
      // qui est encore au-dessus de la ligne de référence.
      const refY = 84;
      for (const s of sections) {
        const top = s.el!.getBoundingClientRect().top;
        if (top <= refY && top > winnerTop) {
          winnerTop = top;
          winner = s.title;
        }
      }
      // Si aucune section n'a franchi la ligne, on garde le titre par défaut
      if (winner !== current.current) {
        current.current = winner;
        document.title = winner;
      }
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.title = DEFAULT_TITLE;
    };
  }, []);

  return null;
}
