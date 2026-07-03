"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

type CacheEntry<T> =
  | { status: "loading"; promise: Promise<T>; data?: T; error?: unknown; fetchedAt?: number }
  | { status: "success"; data: T; promise?: Promise<T>; fetchedAt: number }
  | { status: "error"; error: unknown; data?: T; fetchedAt?: number };

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

function isStale(ts: number, ttl: number | undefined): boolean {
  if (!ttl || ttl <= 0) return true;
  return Date.now() - ts > ttl;
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
      setCacheEntry(key, { status: "success", data, fetchedAt: Date.now() });
      return data;
    })
    .catch((error) => {
      setCacheEntry(key, { status: "error", error });
      throw error;
    });

  setCacheEntry(key, { status: "loading", promise });
  return promise;
}

export function refreshCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const promise = fetcher()
    .then((data) => {
      setCacheEntry(key, { status: "success", data, fetchedAt: Date.now() });
      return data;
    })
    .catch((error) => {
      const existing = globalCache.get(key);
      if (existing?.status !== "success") {
        setCacheEntry(key, { status: "error", error });
      }
      throw error;
    });
  return promise;
}

export interface UseCachedFetchResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<T>;
}

export interface UseCachedFetchOptions {
  enabled?: boolean;
  staleWhileRevalidate?: boolean;
  ttl?: number;
}

export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedFetchOptions = {}
): UseCachedFetchResult<T> {
  const { enabled = true, staleWhileRevalidate = false, ttl } = options;

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
      return;
    }

    if (existing.status === "success" && ttl && isStale(existing.fetchedAt, ttl)) {
      void refreshCache(key, fetcher);
      return;
    }

    if (staleWhileRevalidate && existing.status === "success") {
      void refreshCache(key, fetcher);
    }
  }, [enabled, key, fetcher, ttl, staleWhileRevalidate]);

  return {
    data: entry?.status === "success" ? entry.data : undefined,
    loading: entry?.status === "loading" || !entry,
    error:
      entry?.status === "error"
        ? entry.error instanceof Error
          ? entry.error
          : new Error(String(entry.error))
        : null,
    refetch,
  };
}

export function useOptimisticUpdate<T>(key: string) {
  return useCallback(
    (updater: (current: T) => T) => {
      const entry = globalCache.get(key);
      if (entry?.status === "success") {
        setCacheEntry(key, { status: "success", data: updater(entry.data as T), fetchedAt: entry.fetchedAt });
      }
    },
    [key]
  );
}
