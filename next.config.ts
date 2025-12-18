import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // ==========================================================================
    // PRODUCTION OPTIMIZATIONS
    // ==========================================================================

    // Enable React strict mode for better error detection
    reactStrictMode: true,

    // Optimize images
    images: {
        formats: ['image/avif', 'image/webp'],
        // Allow eBay image domains for future card image support
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'i.ebayimg.com',
            },
        ],
    },

    // ==========================================================================
    // SECURITY HEADERS
    // ==========================================================================
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    // Prevent clickjacking
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    // Prevent MIME type sniffing
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    // Enable XSS protection
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    // Control referrer information
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    // DNS prefetch control
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on',
                    },
                ],
            },
            // Cache API responses appropriately
            {
                source: '/api/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'private, no-cache, no-store, must-revalidate',
                    },
                ],
            },
        ];
    },

    // ==========================================================================
    // PERFORMANCE
    // ==========================================================================

    // Reduce bundle size by excluding source maps in production
    productionBrowserSourceMaps: false,

    // Compress responses
    compress: true,

    // Power-off excessive logging in production
    logging: {
        fetches: {
            fullUrl: process.env.NODE_ENV === 'development',
        },
    },

    // Experimental features for better performance
    experimental: {
        // Optimize package imports
        optimizePackageImports: ['framer-motion', 'lucide-react'],
    },
};

export default nextConfig;
