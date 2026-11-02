interface RateLimitEntry {
  timestamps: number[];
}

const cache = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 60000);
      if (entry.timestamps.length === 0) {
        cache.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

export function checkRateLimit(
  key: string,
  limit = 30,
  windowMs = 60000
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let entry = cache.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    cache.set(key, entry);
  }

  // Filter timestamps within the current window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldest));
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    resetMs: windowMs,
  };
}
