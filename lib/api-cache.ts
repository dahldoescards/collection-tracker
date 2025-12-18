/**
 * =============================================================================
 * API CACHE - In-Memory Caching Layer
 * =============================================================================
 * 
 * Provides fast in-memory caching for API responses to reduce database load.
 * Uses a simple TTL-based invalidation strategy.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

interface CacheStats {
    hits: number;
    misses: number;
    size: number;
}

// =============================================================================
// CACHE IMPLEMENTATION
// =============================================================================

class APICache {
    private cache = new Map<string, CacheEntry<unknown>>();
    private stats: CacheStats = { hits: 0, misses: 0, size: 0 };

    // Default TTL: 30 seconds for dynamic data
    private defaultTTL = 30 * 1000;

    /**
     * Get a cached value
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            this.stats.size = this.cache.size;
            return null;
        }

        this.stats.hits++;
        return entry.data;
    }

    /**
     * Set a cached value
     */
    set<T>(key: string, data: T, ttlMs?: number): void {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl: ttlMs ?? this.defaultTTL,
        };

        this.cache.set(key, entry);
        this.stats.size = this.cache.size;
    }

    /**
     * Invalidate a specific key or pattern
     */
    invalidate(keyOrPattern: string | RegExp): number {
        let deleted = 0;

        if (typeof keyOrPattern === 'string') {
            if (this.cache.delete(keyOrPattern)) {
                deleted++;
            }
        } else {
            for (const key of this.cache.keys()) {
                if (keyOrPattern.test(key)) {
                    this.cache.delete(key);
                    deleted++;
                }
            }
        }

        this.stats.size = this.cache.size;
        return deleted;
    }

    /**
     * Clear all cached data
     */
    clear(): void {
        this.cache.clear();
        this.stats.size = 0;
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Cleanup expired entries
     */
    cleanup(): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        this.stats.size = this.cache.size;
        return cleaned;
    }
}

// Singleton instance
const apiCache = new APICache();

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const cleaned = apiCache.cleanup();
        if (cleaned > 0) {
            console.log(`[API Cache] Cleaned ${cleaned} expired entries`);
        }
    }, 5 * 60 * 1000);
}

// =============================================================================
// EXPORTS
// =============================================================================

export { apiCache, APICache };
export type { CacheEntry, CacheStats };

// Cache key generators
export const cacheKeys = {
    collectionData: () => 'collection:data',
    playerSales: (player: string, days: number) => `sales:${player}:${days}`,
    baselinePrices: () => 'baseline:all',
    marketData: (player: string) => `market:${player}`,
};

// TTL constants (in milliseconds)
export const cacheTTL = {
    collectionData: 60 * 1000,         // 1 minute (dashboard data)
    playerSales: 5 * 60 * 1000,        // 5 minutes (sales don't change often)
    baselinePrices: 30 * 60 * 1000,    // 30 minutes (rarely changes)
    marketData: 60 * 1000,             // 1 minute
};
