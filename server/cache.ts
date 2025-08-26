import NodeCache from 'node-cache';

// Cache configuration
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false, // Don't clone data for better performance
});

// Cache TTL configurations for different data types
export const CACHE_KEYS = {
  USER_PERMISSIONS: 'user_permissions',
  STORES: 'stores',
  PAYMENT_METHODS: 'payment_methods',
  DISCOUNTS: 'discounts',
  POSITIONS: 'positions',
  DASHBOARD_METRICS: 'dashboard_metrics',
} as const;

export const CACHE_TTL = {
  USER_PERMISSIONS: 600, // 10 minutes - permissions don't change often
  STORES: 1800, // 30 minutes - store data is relatively static
  PAYMENT_METHODS: 3600, // 1 hour - payment methods rarely change
  DISCOUNTS: 300, // 5 minutes - discounts may change more frequently
  POSITIONS: 1800, // 30 minutes - positions are relatively static
  DASHBOARD_METRICS: 60, // 1 minute - metrics should be relatively fresh
} as const;

// Generic cache wrapper function
export function withCache<T>(
  key: string, 
  ttl: number, 
  fetchFn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      // Try to get from cache first
      const cachedData = cache.get<T>(key);
      if (cachedData !== undefined) {
        resolve(cachedData);
        return;
      }

      // If not in cache, fetch data
      const data = await fetchFn();
      
      // Store in cache
      cache.set(key, data, ttl);
      
      resolve(data);
    } catch (error) {
      reject(error);
    }
  });
}

// Cache invalidation functions
export function invalidateCache(key: string): void {
  cache.del(key);
}

export function invalidateCachePattern(pattern: string): void {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  cache.del(matchingKeys);
}

export function clearAllCache(): void {
  cache.flushAll();
}

// Get cache statistics
export function getCacheStats() {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    hitRate: cache.getStats().hits / (cache.getStats().hits + cache.getStats().misses) || 0,
  };
}

export default cache;