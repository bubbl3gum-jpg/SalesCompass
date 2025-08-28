import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';

// Create cache instance with default TTL of 5 minutes
const cache = new NodeCache({ stdTTL: 300 });

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
}

export function cacheMiddleware(options: CacheOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const keyGenerator = options.keyGenerator || ((req) => req.originalUrl);
    const key = keyGenerator(req);

    // Try to get data from cache
    const cachedData = cache.get(key);
    if (cachedData) {
      // Add cache hit header
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache the response
    res.json = (data: any) => {
      // Cache the data
      cache.set(key, data, options.ttl);
      
      // Add cache miss header
      res.setHeader('X-Cache', 'MISS');
      
      // Call original json method
      return originalJson(data);
    };

    next();
  };
}

// Function to invalidate cache
export function invalidateCache(pattern?: string) {
  if (pattern) {
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.includes(pattern)) {
        cache.del(key);
      }
    });
  } else {
    cache.flushAll();
  }
}

// Export cache instance for direct usage
export const cacheStore = cache;