"use client";

import { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  r: number;
  seed: number;
};

/**
 * Scène de fond : des fragments dispersés qui se rapprochent et se
 * relient à mesure que le scroll progresse — la métaphore centrale
 * du produit (fragments → contexte unifié).
 * Canvas 2D léger : pas de WebGL, aucun fallback nécessaire.
 */
export function ContextStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let width = 0;
    let height = 0;
    let raf = 0;
    let running = true;
    let cohesion = 0; // 0 = dispersé, 1 = relié
    let targetCohesion = 0;
    let pointerX = 0.5;
    let pointerY = 0.5;

    const NODE_COUNT = window.innerWidth < 768 ? 10 : 14;
    const nodes: Node[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Positions « dispersées » en périphérie, « foyer » au centre.
      for (let i = 0; i < NODE_COUNT; i++) {
        const angle = (i / NODE_COUNT) * Math.PI * 2 + Math.sin(i * 3.7);
        const spread = 0.32 + ((i * 37) % 20) / 100;
        const hx = 0.5 + Math.cos(angle) * spread;
        const hy = 0.46 + Math.sin(angle) * spread * 0.75;
        if (!nodes[i]) {
          nodes[i] = {
            x: hx * width,
            y: hy * height,
            vx: 0,
            vy: 0,
            homeX: hx,
            homeY: hy,
            r: 1.6 + ((i * 13) % 3) * 0.7,
            seed: i * 0.618,
          };
        } else {
          nodes[i].homeX = hx;
          nodes[i].homeY = hy;
        }
      }
    };

    const onScroll = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      targetCohesion = Math.min(1, (doc.scrollTop / max) * 2.2);
    };

    const onPointer = (e: PointerEvent) => {
      pointerX = e.clientX / window.innerWidth;
      pointerY = e.clientY / window.innerHeight;
    };

    const onVisibility = () => {
      running = !document.hidden;
      if (running && !reduced) loop(performance.now());
    };

    const draw = (t: number) => {
      cohesion += (targetCohesion - cohesion) * 0.04;
      ctx.clearRect(0, 0, width, height);

      const cx = width * 0.5 + (pointerX - 0.5) * 24;
      const cy = height * 0.46 + (pointerY - 0.5) * 18;
      const time = t / 1000;

      // Positions : interpolation dispersé → foyer + dérive organique
      for (const n of nodes) {
        const dispersedX = n.homeX * width;
        const dispersedY = n.homeY * height;
        const wobbleX = Math.sin(time * 0.4 + n.seed * 9) * 14;
        const wobbleY = Math.cos(time * 0.3 + n.seed * 7) * 12;
        const tx = dispersedX + (cx - dispersedX) * cohesion + wobbleX * (1 - cohesion * 0.6);
        const ty = dispersedY + (cy - dispersedY) * cohesion + wobbleY * (1 - cohesion * 0.6);
        n.x += (tx - n.x) * 0.03;
        n.y += (ty - n.y) * 0.03;
      }

      // Connexions entre nœuds proches
      const linkDist = 110 + cohesion * 150;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < linkDist) {
            const alpha = (1 - d / linkDist) * (0.05 + cohesion * 0.16);
            ctx.strokeStyle = `rgba(167, 139, 250, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Nœuds — discrets, halo doux
      for (const n of nodes) {
        const pulse = 0.6 + Math.sin(time * 1.2 + n.seed * 12) * 0.4;
        const alpha = 0.32 + cohesion * 0.15 + pulse * 0.1;
        ctx.save();
        ctx.shadowColor = "rgba(167, 139, 250, 0.55)";
        ctx.shadowBlur = 6 + cohesion * 3;
        ctx.fillStyle = `rgba(210, 198, 255, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 1.4 * (1 + cohesion * 0.2), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Halo central discret quand le contexte se forme
      if (cohesion > 0.25) {
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 240);
        glow.addColorStop(0, `rgba(139, 92, 246, ${(cohesion * 0.04).toFixed(3)})`);
        glow.addColorStop(1, "rgba(139, 92, 246, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(cx - 240, cy - 240, 480, 480);
      }
    };

    const loop = (t: number) => {
      if (!running) return;
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    resize();
    onScroll();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    if (window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("pointermove", onPointer, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      // Rendu statique : contexte formé, aucune animation.
      cohesion = targetCohesion = 1;
      draw(0);
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div aria-hidden="true" className="context-stage">
      <canvas ref={canvasRef} />
      <div className="context-stage__vignette" />
    </div>
  );
}
