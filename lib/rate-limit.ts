// Rate limiting simple par token bucket en mémoire (process unique).
const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

export function checkRateLimit(
  key: string,
  max = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW_MS
): boolean {
  const now = Date.now();
  const existing = rateLimitMap.get(key);

  if (!existing) {
    rateLimitMap.set(key, { tokens: max - 1, lastRefill: now });
    return true;
  }

  const elapsed = now - existing.lastRefill;
  const refill = Math.floor((elapsed / windowMs) * max);
  if (refill > 0) {
    existing.tokens = Math.min(existing.tokens + refill, max);
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
