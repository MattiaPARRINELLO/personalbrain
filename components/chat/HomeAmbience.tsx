"use client";

// Champ de particules de l'accueil. Les valeurs sont figées (aucun tirage
// aléatoire) pour que le HTML serveur et le premier rendu client coïncident.
const PARTICLES: {
  left: string;
  bottom: string;
  size: string;
  dur: string;
  delay: string;
  drift: string;
  tint: string;
}[] = [
  { left: "12%", bottom: "8%", size: "2px", dur: "19s", delay: "0s", drift: "14px", tint: "var(--accent)" },
  { left: "19%", bottom: "26%", size: "1px", dur: "24s", delay: "3.5s", drift: "-10px", tint: "var(--accent-cool)" },
  { left: "27%", bottom: "4%", size: "3px", dur: "21s", delay: "7s", drift: "8px", tint: "var(--accent)" },
  { left: "34%", bottom: "38%", size: "1px", dur: "27s", delay: "1.5s", drift: "18px", tint: "var(--accent-soft)" },
  { left: "41%", bottom: "14%", size: "2px", dur: "22s", delay: "11s", drift: "-14px", tint: "var(--accent-cool)" },
  { left: "48%", bottom: "30%", size: "1px", dur: "25s", delay: "5s", drift: "10px", tint: "var(--accent)" },
  { left: "55%", bottom: "6%", size: "2px", dur: "20s", delay: "9s", drift: "-8px", tint: "var(--accent-warm)" },
  { left: "62%", bottom: "22%", size: "1px", dur: "28s", delay: "2.5s", drift: "16px", tint: "var(--accent)" },
  { left: "70%", bottom: "11%", size: "3px", dur: "23s", delay: "13s", drift: "-18px", tint: "var(--accent-cool)" },
  { left: "77%", bottom: "33%", size: "1px", dur: "26s", delay: "6.5s", drift: "12px", tint: "var(--accent-soft)" },
  { left: "84%", bottom: "5%", size: "2px", dur: "18s", delay: "10s", drift: "-12px", tint: "var(--accent)" },
  { left: "90%", bottom: "24%", size: "1px", dur: "29s", delay: "4s", drift: "20px", tint: "var(--accent-warm)" },
];

/** Ambiance de l'accueil : dégradés radiaux, trame en dérive et particules. */
export function HomeAmbience() {
  return (
    <div className="home-ambience" aria-hidden>
      {PARTICLES.map((p) => (
        <span
          key={p.left}
          className="home-particle"
          style={
            {
              left: p.left,
              bottom: p.bottom,
              "--size": p.size,
              "--dur": p.dur,
              "--delay": p.delay,
              "--drift": p.drift,
              "--tint": p.tint,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
