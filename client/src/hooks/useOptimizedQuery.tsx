import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

interface OptimizedQueryOptions<TData> extends UseQueryOptions<TData> {
  // Enable request deduplication
  dedupe?: boolean;
  // Enable result caching
  cacheTime?: number;
  // Enable stale-while-revalidate
  staleTime?: number;
  // Enable request batching
  batch?: boolean;
}

// Request deduplication map
const pendingRequests = new Map<string, Promise<any>>();

export function useOptimizedQuery<TData = unknown>(
  queryKey: any[],
  queryFn: () => Promise<TData>,
  options?: OptimizedQueryOptions<TData>
) {
  const {
    dedupe = true,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 60 * 1000, // 1 minute
    batch = false,
    ...restOptions
  } = options || {};

  // Deduplicate requests
  const optimizedQueryFn = useCallback(async () => {
    const key = JSON.stringify(queryKey);
    
    if (dedupe && pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }

    const promise = queryFn();
    
    if (dedupe) {
      pendingRequests.set(key, promise);
      promise.finally(() => {
        pendingRequests.delete(key);
      });
    }

    return promise;
  }, [queryKey, queryFn, dedupe]);

  return useQuery({
    queryKey,
    queryFn: optimizedQueryFn,
    gcTime: cacheTime,
    staleTime,
    ...restOptions,
  });
}

// Batch multiple queries
export function useBatchedQueries<T>(
  queries: Array<{
    key: any[];
    fn: () => Promise<T>;
  }>
) {
  const batchTimeout = useRef<NodeJS.Timeout>();
  const batchQueue = useRef<typeof queries>([]);

  useEffect(() => {
    if (batchQueue.current.length > 0) {
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }

      batchTimeout.current = setTimeout(() => {
        // Process batch
        Promise.all(batchQueue.current.map(q => q.fn()));
        batchQueue.current = [];
      }, 50); // Batch window of 50ms
    }

    return () => {
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }
    };
  }, [queries]);

  // Add queries to batch
  batchQueue.current = queries;

  return queries.map(q => 
    useQuery({
      queryKey: q.key,
      queryFn: q.fn,
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    })
  );
}