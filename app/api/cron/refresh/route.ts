/**
 * =============================================================================
 * CRON REFRESH ENDPOINT - Daily Automated Sales Refresh
 * =============================================================================
 * 
 * Protected endpoint for Railway cron jobs to trigger daily sales refresh.
 * Runs at 7:00 AM EST (12:00 UTC) every day.
 * 
 * Security:
 * - Requires CRON_SECRET bearer token in Authorization header
 * - Can also be triggered by Railway's internal cron system
 * 
 * This endpoint directly processes all players without making HTTP calls
 * to itself, preventing timeout issues.
 * 
 * Usage:
 *   Railway Cron: Automatically calls this endpoint
 *   Manual: curl -X POST https://your-app.railway.app/api/cron/refresh \
 *           -H "Authorization: Bearer YOUR_CRON_SECRET"
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';

import {
    initializeDatabase,
    getAllTrackedCards,
    upsertCurrentMarket,
    recordAllPriceSnapshots,
    getBaselinePrice,
} from '@/lib/collection-database';

import { scrapeAndStorePlayer } from '@/lib/unified-scraper';
import { CurrentMarketData } from '@/lib/collection-types';
import { apiCache } from '@/lib/api-cache';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Maximum time to spend refreshing before returning a partial result
 * Railway has a 5-minute timeout, so we stop at 4.5 minutes to be safe
 */
const MAX_EXECUTION_TIME_MS = 4.5 * 60 * 1000; // 4.5 minutes

/**
 * Delay between player scrapes to avoid rate limiting
 */
const RATE_LIMIT_DELAY_MS = 1500;

// =============================================================================
// TYPES
// =============================================================================

interface CronResult {
    success: boolean;
    message: string;
    stats: {
        totalPlayers: number;
        refreshed: number;
        failed: number;
        skipped: number;
        newSalesAdded: number;
        executionTimeMs: number;
        timestamp: string;
    };
    errors?: Array<{ player: string; error: string }>;
}

// =============================================================================
// LOGGING
// =============================================================================

const log = {
    info: (msg: string) => console.log(`[Cron Refresh] ${msg}`),
    success: (msg: string) => console.log(`[Cron Refresh] ✅ ${msg}`),
    warn: (msg: string) => console.warn(`[Cron Refresh] ⚠️ ${msg}`),
    error: (msg: string) => console.error(`[Cron Refresh] ❌ ${msg}`),
};

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Verify the request is authorized to trigger cron
 */
function isAuthorized(request: NextRequest): boolean {
    // Check for CRON_SECRET environment variable
    const cronSecret = process.env.CRON_SECRET;

    // If no secret is configured, only allow in development
    if (!cronSecret) {
        if (process.env.NODE_ENV === 'development') {
            log.warn('CRON_SECRET not set - allowing in development mode');
            return true;
        }
        log.error('CRON_SECRET not configured');
        return false;
    }

    // Check Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        // Also check for Railway's internal cron header
        const railwayCron = request.headers.get('X-Railway-Cron');
        if (railwayCron === 'true') {
            log.info('Request authorized via Railway cron header');
            return true;
        }
        return false;
    }

    // Validate Bearer token
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || token !== cronSecret) {
        return false;
    }

    return true;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    log.info('='.repeat(60));
    log.info('Daily refresh cron job triggered');
    log.info(`Time: ${new Date().toISOString()}`);
    log.info('='.repeat(60));

    // Verify authorization
    if (!isAuthorized(request)) {
        log.error('Unauthorized request attempted');
        return NextResponse.json(
            {
                success: false,
                error: 'Unauthorized. Provide valid CRON_SECRET in Authorization header.'
            },
            { status: 401 }
        );
    }

    log.info('Request authorized');

    try {
        // Initialize database
        initializeDatabase();

        // Get all tracked players
        const allCards = getAllTrackedCards();
        const playerNames = allCards.map(c => c.normalizedPlayerName);

        log.info(`Found ${playerNames.length} players to refresh`);

        // Track results
        let refreshed = 0;
        let failed = 0;
        let skipped = 0;
        let newSalesAdded = 0;
        const errors: Array<{ player: string; error: string }> = [];

        // Process each player
        for (let i = 0; i < playerNames.length; i++) {
            const playerName = playerNames[i];

            // Check if we're running out of time
            const elapsed = Date.now() - startTime;
            if (elapsed > MAX_EXECUTION_TIME_MS) {
                const remaining = playerNames.length - i;
                log.warn(`Time limit reached - skipping ${remaining} remaining players`);
                skipped = remaining;
                break;
            }

            try {
                // Get known release year for better search results
                const baseline = getBaselinePrice(playerName);
                const targetYear = baseline?.releaseYear || undefined;

                log.info(`[${i + 1}/${playerNames.length}] Refreshing: ${playerName}${targetYear ? ` [${targetYear}]` : ''}`);

                // Scrape player data
                const result = await scrapeAndStorePlayer(playerName, targetYear);

                if (result.success && result.averagePrice !== null) {
                    // Update current market data
                    const marketData: CurrentMarketData = {
                        playerName: result.playerName,
                        normalizedPlayerName: result.normalizedPlayerName,
                        averagePrice: result.averagePrice,
                        medianPrice: result.medianPrice || result.averagePrice,
                        lastSalePrice: result.lastSalePrice || result.averagePrice,
                        lastSaleDate: result.lastSaleDate || new Date(),
                        sampleSize: result.sampleSize,
                        verifiedSales: [],
                        fetchedAt: new Date(),
                        cardType: result.cardType || 'base',
                        inferredYear: result.inferredFirstBowmanYear,
                    };

                    upsertCurrentMarket(marketData);
                    refreshed++;
                    newSalesAdded += result.salesInserted;

                    log.success(`${playerName}: $${result.averagePrice} avg, ${result.salesInserted} new sales`);
                } else {
                    failed++;
                    const errorMsg = result.error?.message || 'No valid sales found';
                    errors.push({ player: playerName, error: errorMsg });
                    log.warn(`${playerName}: ${errorMsg}`);
                }

                // Rate limiting between requests
                if (i < playerNames.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
                }

            } catch (err) {
                failed++;
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                errors.push({ player: playerName, error: errorMsg });
                log.error(`${playerName}: ${errorMsg}`);
            }
        }

        // Record price snapshots for historical tracking
        if (refreshed > 0) {
            const snapshots = recordAllPriceSnapshots();
            log.info(`Recorded ${snapshots} price history snapshots`);

            // Invalidate cache so fresh data is served
            apiCache.invalidate(/collection/);
            apiCache.invalidate(/sales/);
            log.info('Cache invalidated');
        }

        const executionTimeMs = Date.now() - startTime;

        // Build result
        const result: CronResult = {
            success: true,
            message: `Refresh complete: ${refreshed} updated, ${failed} failed, ${skipped} skipped`,
            stats: {
                totalPlayers: playerNames.length,
                refreshed,
                failed,
                skipped,
                newSalesAdded,
                executionTimeMs,
                timestamp: new Date().toISOString(),
            },
            errors: errors.length > 0 ? errors : undefined,
        };

        log.info('='.repeat(60));
        log.success(`Cron complete in ${(executionTimeMs / 1000).toFixed(1)}s`);
        log.info(`  Refreshed: ${refreshed}`);
        log.info(`  Failed: ${failed}`);
        log.info(`  Skipped: ${skipped}`);
        log.info(`  New sales: ${newSalesAdded}`);
        log.info('='.repeat(60));

        return NextResponse.json(result);

    } catch (error) {
        const executionTimeMs = Date.now() - startTime;

        log.error(`Cron failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

        return NextResponse.json(
            {
                success: false,
                message: 'Cron job failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                stats: {
                    executionTimeMs,
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 500 }
        );
    }
}

// =============================================================================
// GET HANDLER - Health Check
// =============================================================================

export async function GET(request: NextRequest) {
    // Simple health check - can also show last run status
    return NextResponse.json({
        status: 'ok',
        endpoint: '/api/cron/refresh',
        method: 'POST',
        description: 'Daily sales refresh cron endpoint',
        schedule: '7:00 AM EST (12:00 UTC)',
        authorization: 'Bearer token required (CRON_SECRET)',
    });
}
