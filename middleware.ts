import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * =============================================================================
 * MIDDLEWARE - Security Headers & Protection
 * =============================================================================
 * 
 * Applies security headers and basic protection to all requests.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

// Security headers to apply to all responses
const securityHeaders: Record<string, string> = {
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Enable XSS filter (legacy browsers)
    'X-XSS-Protection': '1; mode=block',

    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions policy (restrict sensitive features)
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

    // Content Security Policy
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://api.ebay.com https://130point.com",
        "frame-ancestors 'none'",
    ].join('; '),
};

// Paths that should be rate limited more strictly
const STRICT_RATE_LIMIT_PATHS = [
    '/api/auth/register',
    '/api/auth/signin',
];

// Paths that should bypass certain security checks (e.g., cron)
const INTERNAL_PATHS = [
    '/api/cron/',
];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip middleware for static files and internal Next.js routes
    if (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/static/') ||
        pathname.includes('.') // Static files (favicon.ico, etc.)
    ) {
        return NextResponse.next();
    }

    // Create response
    const response = NextResponse.next();

    // Apply security headers
    for (const [key, value] of Object.entries(securityHeaders)) {
        response.headers.set(key, value);
    }

    // Add CORS headers for API routes
    if (pathname.startsWith('/api/')) {
        const origin = request.headers.get('origin');

        // Allow same-origin requests
        if (origin) {
            const url = new URL(request.url);
            if (origin === url.origin || origin === process.env.NEXTAUTH_URL) {
                response.headers.set('Access-Control-Allow-Origin', origin);
                response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                response.headers.set('Access-Control-Max-Age', '86400');
            }
        }

        // Handle preflight requests
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, {
                status: 200,
                headers: response.headers,
            });
        }
    }

    // Log API requests (basic request logging)
    if (pathname.startsWith('/api/') && !pathname.includes('/auth/session')) {
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] ||
            request.headers.get('x-real-ip') ||
            'unknown';
        console.log(`[Middleware] ${request.method} ${pathname} - IP: ${clientIp}`);
    }

    return response;
}

// Configure which routes the middleware runs on
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
