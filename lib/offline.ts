"use client";

const CACHE_PREFIX = "brain-cache:";

export async function offlineFetch<T>(url: string): Promise<T> {
  const cacheKey = CACHE_PREFIX + url;

  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (res.ok) {
      const data = (await res.json()) as T;
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
      } catch { /* storage plein */ }
      return data;
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    // Offline or error — try cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { data: T; ts: number };
        return parsed.data;
      }
    } catch { /* cache invalide */ }
    throw err;
  }
}

export function clearOfflineCache() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
