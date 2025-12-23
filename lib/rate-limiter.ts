/**
 * =============================================================================
 * RATE LIMITER - In-Memory Rate Limiting
 * =============================================================================
 * 
 * Simple token bucket rate limiter for API endpoints.
 * Uses in-memory storage (resets on server restart).
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

interface RateLimitEntry {
    tokens: number;
    lastRefill: number;
}

interface RateLimitConfig {
    /** Maximum tokens in bucket */
    maxTokens: number;
    /** Tokens to add per refill interval */
    refillRate: number;
    /** Refill interval in milliseconds */
    refillInterval: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default rate limit configs by tier */
export const RATE_LIMIT_CONFIGS = {
    /** Strict limit for sensitive endpoints (auth, registration) */
    strict: {
        maxTokens: 5,
        refillRate: 1,
        refillInterval: 60 * 1000, // 1 per minute refill
    } as RateLimitConfig,

    /** Standard limit for normal API endpoints */
    standard: {
        maxTokens: 30,
        refillRate: 5,
        refillInterval: 60 * 1000, // 5 per minute refill
    } as RateLimitConfig,

    /** Relaxed limit for read-only endpoints */
    relaxed: {
        maxTokens: 100,
        refillRate: 20,
        refillInterval: 60 * 1000, // 20 per minute refill
    } as RateLimitConfig,

    /** Very strict for password reset, registration */
    auth: {
        maxTokens: 3,
        refillRate: 1,
        refillInterval: 5 * 60 * 1000, // 1 per 5 minutes refill
    } as RateLimitConfig,
} as const;

// =============================================================================
// RATE LIMITER CLASS
// =============================================================================

class RateLimiter {
    private buckets: Map<string, RateLimitEntry> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Cleanup old entries every 10 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 10 * 60 * 1000);
    }

    /**
     * Check if a request is allowed and consume a token
     */
    check(key: string, config: RateLimitConfig): RateLimitResult {
        const now = Date.now();
        let entry = this.buckets.get(key);

        if (!entry) {
            // New entry - start with full bucket
            entry = {
                tokens: config.maxTokens,
                lastRefill: now,
            };
            this.buckets.set(key, entry);
        }

        // Refill tokens based on time passed
        const timePassed = now - entry.lastRefill;
        const refillCount = Math.floor(timePassed / config.refillInterval);

        if (refillCount > 0) {
            entry.tokens = Math.min(
                config.maxTokens,
                entry.tokens + (refillCount * config.refillRate)
            );
            entry.lastRefill = now;
        }

        // Calculate reset time
        const resetIn = entry.tokens > 0
            ? 0
            : config.refillInterval - (timePassed % config.refillInterval);

        // Check if allowed
        if (entry.tokens > 0) {
            entry.tokens -= 1;
            return {
                allowed: true,
                remaining: entry.tokens,
                resetIn: 0,
            };
        }

        return {
            allowed: false,
            remaining: 0,
            resetIn,
        };
    }

    /**
     * Get rate limit status without consuming a token
     */
    status(key: string, config: RateLimitConfig): RateLimitResult {
        const entry = this.buckets.get(key);

        if (!entry) {
            return {
                allowed: true,
                remaining: config.maxTokens,
                resetIn: 0,
            };
        }

        const now = Date.now();
        const timePassed = now - entry.lastRefill;
        const refillCount = Math.floor(timePassed / config.refillInterval);
        const currentTokens = Math.min(
            config.maxTokens,
            entry.tokens + (refillCount * config.refillRate)
        );

        return {
            allowed: currentTokens > 0,
            remaining: currentTokens,
            resetIn: currentTokens > 0 ? 0 : config.refillInterval - (timePassed % config.refillInterval),
        };
    }

    /**
     * Reset rate limit for a key
     */
    reset(key: string): void {
        this.buckets.delete(key);
    }

    /**
     * Cleanup old entries (older than 1 hour with full buckets)
     */
    private cleanup(): void {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        for (const [key, entry] of this.buckets.entries()) {
            if (now - entry.lastRefill > oneHour) {
                this.buckets.delete(key);
            }
        }

        console.log(`[RateLimiter] Cleaned up, ${this.buckets.size} entries remaining`);
    }

    /**
     * Stop cleanup interval (for testing/shutdown)
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/** Global rate limiter instance */
export const rateLimiter = new RateLimiter();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get client identifier from request (IP or fallback)
 */
export function getClientId(request: Request): string {
    // Try to get real IP from headers (for proxied requests)
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return realIp;
    }

    // Fallback to a hash of user agent + accept headers
    const ua = request.headers.get('user-agent') || 'unknown';
    const accept = request.headers.get('accept') || 'unknown';
    return `fallback:${hashString(ua + accept)}`;
}

/**
 * Simple string hash for fallback client ID
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): Headers {
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', config.maxTokens.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', Math.ceil(result.resetIn / 1000).toString());
    return headers;
}
