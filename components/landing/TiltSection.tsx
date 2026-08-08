"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Incline la section « depuis l'horizon » au fil du scroll : elle arrive
 * penchée par le bas (rotateX) et s'aplatit quand elle atteint le haut du
 * viewport. Scroll-driven, sans transition, désactivé en reduced-motion.
 */
export function TiltSection({
  children,
  className,
  maxTilt = 10,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let raf = 0;
    const update = () => {
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      // p = 1 quand le haut de la section touche le haut du viewport, 0 en bas d'écran
      const p = Math.min(Math.max((vh - top) / vh, 0), 1);
      setTilt(maxTilt * (1 - p));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [maxTilt]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: `perspective(1400px) rotateX(${tilt}deg)`,
        transformOrigin: "center top",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}
