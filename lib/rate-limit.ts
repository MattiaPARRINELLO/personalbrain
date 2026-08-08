// Rate limiting simple par token bucket en mémoire (process unique).
const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const existing = rateLimitMap.get(key);

  if (!existing) {
    rateLimitMap.set(key, { tokens: RATE_LIMIT_MAX - 1, lastRefill: now });
    return true;
  }

  const elapsed = now - existing.lastRefill;
  const refill = Math.floor((elapsed / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_MAX);
  if (refill > 0) {
    existing.tokens = Math.min(existing.tokens + refill, RATE_LIMIT_MAX);
    existing.lastRefill = now;
  }

  if (existing.tokens <= 0) return false;
  existing.tokens--;
  return true;
}

// Purge périodique des buckets inactifs (mémoire bornée).
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitMap) {
    if (now - bucket.lastRefill > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000).unref();
