"use client";

import { useSyncExternalStore } from "react";

// Horloge partagée par l'accueil du chat et le panneau de droite, rafraîchie
// toutes les 30 s. Le snapshot serveur vaut 0 : le HTML rendu par le serveur et
// le premier rendu client sont donc identiques (aucune erreur d'hydratation).
const TICK_MS = 30_000;

let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (now === 0) now = Date.now();
  if (timer === null) {
    timer = setInterval(() => {
      now = Date.now();
      for (const cb of listeners) cb();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return now;
}

function getServerSnapshot(): number {
  return 0;
}

/** Timestamp ms courant, rafraîchi toutes les 30 s. Vaut 0 côté serveur. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
