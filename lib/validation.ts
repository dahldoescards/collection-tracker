/**
 * =============================================================================
 * INPUT VALIDATION - Security and Sanitization Utilities
 * =============================================================================
 * 
 * Provides input validation, sanitization, and security helpers for API routes.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum allowed player name length */
export const MAX_PLAYER_NAME_LENGTH = 100;

/** Maximum allowed days parameter */
export const MAX_DAYS_BACK = 365 * 2; // 2 years

/** Minimum allowed days parameter */
export const MIN_DAYS_BACK = 1;

/** Maximum players per refresh request */
export const MAX_PLAYERS_PER_REQUEST = 50;

// =============================================================================
// STRING VALIDATION
// =============================================================================

/**
 * Validate and sanitize a player name
 * - Trims whitespace
 * - Lowercases for normalization
 * - Removes potentially dangerous characters
 * - Validates length
 */
export function sanitizePlayerName(input: unknown): string | null {
    if (typeof input !== 'string') return null;

    // Trim and lowercase
    let sanitized = input.trim().toLowerCase();

    // Remove any characters that aren't letters, spaces, apostrophes, or hyphens
    sanitized = sanitized.replace(/[^a-z\s'\-.]/gi, '');

    // Collapse multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Validate length
    if (sanitized.length === 0 || sanitized.length > MAX_PLAYER_NAME_LENGTH) {
        return null;
    }

    return sanitized;
}

/**
 * Validate days parameter
 */
export function validateDays(input: unknown): number {
    if (input === null || input === undefined) {
        return 90; // Default
    }

    const num = typeof input === 'string' ? parseInt(input, 10) : input;

    if (typeof num !== 'number' || isNaN(num)) {
        return 90;
    }

    // Clamp to valid range
    return Math.min(Math.max(num, MIN_DAYS_BACK), MAX_DAYS_BACK);
}

/**
 * Validate an array of player names
 */
export function validatePlayerNames(input: unknown): string[] | null {
    if (!Array.isArray(input)) return null;

    const sanitized: string[] = [];

    for (const name of input) {
        const clean = sanitizePlayerName(name);
        if (clean) {
            sanitized.push(clean);
        }
    }

    // Check count
    if (sanitized.length === 0 || sanitized.length > MAX_PLAYERS_PER_REQUEST) {
        return null;
    }

    return sanitized;
}

// =============================================================================
// URL VALIDATION
// =============================================================================

/**
 * Validate that a URL is a valid eBay URL
 */
export function isValidEbayUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.hostname.endsWith('ebay.com');
    } catch {
        return false;
    }
}

// =============================================================================
// DATE VALIDATION
// =============================================================================

/**
 * Validate a date string (ISO format)
 */
export function isValidDateString(input: unknown): input is string {
    if (typeof input !== 'string') return false;

    const date = new Date(input);
    return !isNaN(date.getTime());
}

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

/**
 * Create a standardized error response
 */
export function createErrorResponse(
    code: string,
    message: string,
    status: number = 400
): { error: { code: string; message: string }; status: number } {
    return {
        error: { code, message },
        status,
    };
}

/**
 * Validate request content type
 */
export function isJsonContentType(request: Request): boolean {
    const contentType = request.headers.get('content-type');
    return contentType?.includes('application/json') ?? false;
}

// =============================================================================
// RATE LIMITING HELPERS
// =============================================================================

/**
 * Simple in-memory rate limiter for development
 * In production, use Redis or similar
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
    identifier: string,
    maxRequests: number = 100,
    windowMs: number = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const record = requestCounts.get(identifier);

    if (!record || now > record.resetTime) {
        // Start new window
        requestCounts.set(identifier, {
            count: 1,
            resetTime: now + windowMs
        });
        return {
            allowed: true,
            remaining: maxRequests - 1,
            resetIn: windowMs
        };
    }

    if (record.count >= maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetIn: record.resetTime - now
        };
    }

    record.count++;
    return {
        allowed: true,
        remaining: maxRequests - record.count,
        resetIn: record.resetTime - now
    };
}

/**
 * Clean up old rate limit records (call periodically)
 */
export function cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, record] of requestCounts) {
        if (now > record.resetTime) {
            requestCounts.delete(key);
        }
    }
}

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupRateLimits, 5 * 60 * 1000);
}
