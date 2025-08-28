// Backend Optimization Configuration
import { Request, Response, NextFunction } from 'express';

// Query optimization with connection pooling
export const dbQueryConfig = {
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
  },
  statement_timeout: 5000, // 5 seconds
  query_timeout: 5000,
};

// Rate limiting configuration for API endpoints
export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
};

// Compression settings
export const compressionConfig = {
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return true;
  },
  level: 6, // Balanced compression level
};

// Cache configuration for different endpoints
export const cacheConfig = {
  '/api/reference-sheets': { ttl: 300 }, // 5 minutes
  '/api/stores': { ttl: 300 },
  '/api/positions': { ttl: 600 }, // 10 minutes
  '/api/staff': { ttl: 300 },
  '/api/payment-methods': { ttl: 3600 }, // 1 hour
  '/api/discounts': { ttl: 300 },
  '/api/pricelist': { ttl: 600 },
  '/api/import/jobs': { ttl: 5 }, // Short cache for import jobs
};

// Batch processing configuration
export const batchConfig = {
  maxBatchSize: 100,
  processingDelay: 50, // ms between batch processing
};

// Response optimization middleware
export function optimizeResponse() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Enable gzip compression
    res.set('Content-Encoding', 'gzip');
    
    // Set cache headers
    if (req.method === 'GET') {
      const path = req.path;
      const config = cacheConfig[path];
      if (config) {
        res.set('Cache-Control', `public, max-age=${config.ttl}`);
      }
    }
    
    next();
  };
}

// Query result pagination
export function paginate(query: any, page: number = 1, limit: number = 50) {
  const offset = (page - 1) * limit;
  return query.limit(limit).offset(offset);
}

// Efficient data serialization
export function optimizeJsonResponse(data: any) {
  // Remove null/undefined values to reduce payload
  const cleaned = JSON.parse(JSON.stringify(data, (key, value) => 
    value == null ? undefined : value
  ));
  return cleaned;
}