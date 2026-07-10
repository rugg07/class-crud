import type Redis from 'ioredis';

// Generic cache lookup with TTL fallback to fetcher on miss.
export async function cacheLookup<T>(
  redis: Redis,
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 60
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }

  const result = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(result));
  return result;
}
