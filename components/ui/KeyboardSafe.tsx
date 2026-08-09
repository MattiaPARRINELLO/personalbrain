"use client";

import { useEffect, useState } from "react";

/**
 * Ajuste le padding bas du composer quand le clavier mobile est ouvert.
 * `interactive-widget=resizes-content` redimensionne déjà la page ; ce
 * composant couvre les cas où le navigateur ne suit pas (iOS <= 15, Android
 * avec soft keyboard) en suivant visualViewport.
 */
export function KeyboardSafe({ children }: { children: React.ReactNode }) {
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const diff = vv.height - window.innerHeight;
      setKb(diff < 0 ? -diff : 0);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div style={{ paddingBottom: kb > 0 ? kb : undefined }} className="transition-[padding] duration-200 ease-out">
      {children}
    </div>
  );
}
