"use client";

const CACHE_PREFIX = "brain-cache:";

export function clearOfflineCache() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
