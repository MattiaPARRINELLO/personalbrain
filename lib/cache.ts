"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

type CacheEntry<T> =
  | { status: "loading"; promise: Promise<T>; data?: T; error?: unknown }
  | { status: "success"; data: T; promise?: Promise<T> }
  | { status: "error"; error: unknown; data?: T };

const globalCache = new Map<string, CacheEntry<unknown>>();

const subscribers = new Map<string, Set<() => void>>();

function notify(key: string) {
  const set = subscribers.get(key);
  if (set) {
    for (const cb of set) cb();
  }
}

function getSnapshot<T>(key: string): CacheEntry<T> | undefined {
  return globalCache.get(key) as CacheEntry<T> | undefined;
}

function subscribe(key: string, callback: () => void) {
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(callback);
  return () => {
    set?.delete(callback);
  };
}

function setCacheEntry<T>(key: string, entry: CacheEntry<T>) {
  globalCache.set(key, entry as CacheEntry<unknown>);
  notify(key);
}

export function invalidateCache(key: string) {
  globalCache.delete(key);
  notify(key);
}

export function preloadCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = globalCache.get(key);
  if (existing?.status === "success") {
    return Promise.resolve(existing.data as T);
  }
  if (existing?.status === "loading" && existing.promise) {
    return existing.promise as Promise<T>;
  }

  const promise = fetcher()
    .then((data) => {
      setCacheEntry(key, { status: "success", data });
      return data;
    })
    .catch((error) => {
      setCacheEntry(key, { status: "error", error });
      throw error;
    });

  setCacheEntry(key, { status: "loading", promise });
  return promise;
}

export interface UseCachedFetchResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<T>;
}

export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { enabled?: boolean; staleWhileRevalidate?: boolean } = {}
): UseCachedFetchResult<T> {
  const { enabled = true, staleWhileRevalidate = false } = options;

  const entry = useSyncExternalStore(
    useCallback((callback) => subscribe(key, callback), [key]),
    useCallback(() => getSnapshot<T>(key), [key]),
    useCallback(() => getSnapshot<T>(key), [key])
  );

  const refetch = useCallback(async () => {
    invalidateCache(key);
    return preloadCache(key, fetcher);
  }, [key, fetcher]);

  useEffect(() => {
    if (!enabled) return;
    const existing = globalCache.get(key);
    if (!existing) {
      void preloadCache(key, fetcher);
    } else if (staleWhileRevalidate && existing.status === "success") {
      void fetcher().then((data) => {
        setCacheEntry(key, { status: "success", data });
      });
    }
  }, [enabled, key, fetcher, staleWhileRevalidate]);

  return {
    data: entry?.status === "success" ? entry.data : undefined,
    loading: entry?.status === "loading" || !entry,
    error: entry?.status === "error" ? (entry.error instanceof Error ? entry.error : new Error(String(entry.error))) : null,
    refetch,
  };
}

export function useOptimisticUpdate<T>(key: string) {
  return useCallback(
    (updater: (current: T) => T) => {
      const entry = globalCache.get(key);
      if (entry?.status === "success") {
        setCacheEntry(key, { status: "success", data: updater(entry.data as T) });
      }
    },
    [key]
  );
}
