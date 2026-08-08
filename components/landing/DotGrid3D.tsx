"use client";

import { useEffect, useRef } from "react";
import type * as THREE from "three";

const POINT_COUNT = 2400;
const SPREAD = 34;
const DEPTH = 26;
const TRAVEL = 90;

/**
 * Grille de points 3D en fond de page. L'ensemble avance vers la caméra au
 * fil du scroll (effet de voyage) et pivote lentement. Three.js est chargé
 * dynamiquement côté client : zéro impact SSR, zéro WebGL si indisponible.
 */
export function DotGrid3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import("three");
      if (cancelled || !mount) return;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
      } catch {
        return; // WebGL indisponible : on laisse le fond nu
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        60,
        mount.clientWidth / mount.clientHeight,
        0.1,
        200
      );
      camera.position.z = 22;

      // Volume de points : réparti en largeur, hauteur et profondeur
      const positions = new Float32Array(POINT_COUNT * 3);
      for (let i = 0; i < POINT_COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * SPREAD;
        positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
        positions[i * 3 + 2] = (Math.random() - 0.5) * DEPTH;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: 0x71717a,
        size: 0.09,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      let travel = 0;
      let raf = 0;
      const clock = new THREE.Clock();

      const render = () => {
        const dt = clock.getDelta();
        // Avance vers la caméra au scroll, retour élastique vers l'arrière
        points.position.z = travel;
        // Pivot lent permanent
        points.rotation.y += dt * 0.02;
        points.rotation.x = Math.sin(performance.now() * 0.0001) * 0.04;
        renderer.render(scene, camera);
      };

      const loop = () => {
        render();
        raf = requestAnimationFrame(loop);
      };

      let scrollRaf = 0;
      const onScroll = () => {
        cancelAnimationFrame(scrollRaf);
        scrollRaf = requestAnimationFrame(() => {
          const doc = document.documentElement;
          const max = Math.max(doc.scrollHeight - window.innerHeight, 1);
          const p = Math.min(Math.max(window.scrollY / max, 0), 1);
          travel = p * TRAVEL;
        });
      };
      const onResize = () => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      onScroll();
      render();

      if (!reduced) {
        loop();
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        cancelAnimationFrame(scrollRaf);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
