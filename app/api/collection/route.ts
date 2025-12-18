/**
 * =============================================================================
 * COLLECTION API ROUTE - Main Data Endpoint
 * =============================================================================
 * 
 * API route for fetching collection data including tracked cards and stats.
 * Supports full data fetch and individual player refresh.
 * 
 * Now uses unified-scraper which stores ALL sales in database for charting.
 * 
 * Endpoints:
 * - GET /api/collection - Fetch all tracked cards and stats
 * - POST /api/collection/refresh - Refresh market data for players
 * 
 * @author Collection Tool
 * @version 2.0.0
 */

import { NextRequest, NextResponse } from 'next/server';

import {
    initializeDatabase,
    getAllTrackedCards,
    getDashboardStats,
    upsertCurrentMarket,
    recordPriceSnapshot,
    recordAllPriceSnapshots,
    getBaselinePrice,
} from '@/lib/collection-database';
import { scrapeAndStorePlayer } from '@/lib/unified-scraper';
import { TrackedCard, DashboardStats, CollectionConfig, DEFAULT_COLLECTION_CONFIG, CurrentMarketData } from '@/lib/collection-types';

// =============================================================================
// TYPES
// =============================================================================

interface CollectionResponse {
    success: boolean;
    data?: {
        cards: TrackedCard[];
        stats: DashboardStats;
        config: CollectionConfig;
    };
    error?: {
        code: string;
        message: string;
    };
}

interface RefreshRequest {
    playerNames?: string[];
    refreshAll?: boolean;
}

interface RefreshResponse {
    success: boolean;
    refreshed: number;
    failed: number;
    errors?: { playerName: string; error: string }[];
}

// =============================================================================
// CACHE IMPORT
// =============================================================================

import { apiCache, cacheKeys, cacheTTL } from '@/lib/api-cache';

// =============================================================================
// GET HANDLER - Fetch Collection Data (with caching)
// =============================================================================

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    console.log('[Collection API] GET /api/collection');

    try {
        // Get configuration from query params (optional overrides)
        const searchParams = request.nextUrl.searchParams;
        const config: Partial<CollectionConfig> = {};

        if (searchParams.has('staleThresholdHours')) {
            config.staleThresholdHours = parseInt(searchParams.get('staleThresholdHours')!);
        }

        // Check if we should skip cache
        const skipCache = searchParams.get('fresh') === 'true';
        const cacheKey = cacheKeys.collectionData();

        // Try to get from cache first
        if (!skipCache) {
            const cached = apiCache.get<CollectionResponse>(cacheKey);
            if (cached) {
                console.log(`[Collection API] Cache HIT - ${Date.now() - startTime}ms`);
                return NextResponse.json(cached, {
                    headers: {
                        'Cache-Control': 'private, max-age=30',
                        'X-Cache': 'HIT',
                        'X-Response-Time': `${Date.now() - startTime}ms`,
                    },
                });
            }
        }

        // Cache miss - fetch from database
        initializeDatabase();
        const mergedConfig = { ...DEFAULT_COLLECTION_CONFIG, ...config };

        const cards = getAllTrackedCards(mergedConfig);
        const stats = getDashboardStats(mergedConfig);

        console.log(`[Collection API] Cache MISS - returning ${cards.length} cards in ${Date.now() - startTime}ms`);

        const response: CollectionResponse = {
            success: true,
            data: {
                cards,
                stats,
                config: mergedConfig,
            },
        };

        // Store in cache
        apiCache.set(cacheKey, response, cacheTTL.collectionData);

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'private, max-age=30',
                'X-Cache': 'MISS',
                'X-Response-Time': `${Date.now() - startTime}ms`,
            },
        });
    } catch (error) {
        console.error('[Collection API] Error:', error);

        const response: CollectionResponse = {
            success: false,
            error: {
                code: 'FETCH_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error occurred',
            },
        };

        return NextResponse.json(response, { status: 500 });
    }
}

// =============================================================================
// POST HANDLER - Refresh Market Data
// =============================================================================

export async function POST(request: NextRequest) {
    console.log('[Collection API] POST /api/collection (refresh)');

    try {
        // Parse request body
        const body = await request.json() as RefreshRequest;

        // Validate request
        if (!body.playerNames?.length && !body.refreshAll) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Must provide playerNames array or set refreshAll to true',
                },
            }, { status: 400 });
        }

        // Initialize database
        initializeDatabase();

        // Get players to refresh
        let playersToRefresh: string[] = [];

        if (body.refreshAll) {
            const allCards = getAllTrackedCards();
            playersToRefresh = allCards.map(c => c.normalizedPlayerName);
        } else {
            playersToRefresh = body.playerNames!;
        }

        console.log(`[Collection API] Refreshing ${playersToRefresh.length} players`);

        // Refresh each player with rate limiting
        let refreshed = 0;
        let failed = 0;
        const errors: { playerName: string; error: string }[] = [];

        for (const playerName of playersToRefresh) {
            try {
                // Look up known 1st Bowman year from baseline data
                const baseline = getBaselinePrice(playerName.toLowerCase().trim());
                const targetYear = baseline?.releaseYear || undefined;

                console.log(`[Collection API] Scraping: ${playerName}${targetYear ? ` [${targetYear}]` : ''}`);

                // Use unified scraper with year-specific query for better results
                // e.g., "Termarr Johnson 2022 Bowman Chrome Auto"
                const result = await scrapeAndStorePlayer(playerName, targetYear);

                if (result.success && result.averagePrice !== null) {
                    // Convert to CurrentMarketData format for current_market table
                    const marketData: CurrentMarketData = {
                        playerName: result.playerName,
                        normalizedPlayerName: result.normalizedPlayerName,
                        averagePrice: result.averagePrice,
                        medianPrice: result.medianPrice || result.averagePrice,
                        lastSalePrice: result.lastSalePrice || result.averagePrice,
                        lastSaleDate: result.lastSaleDate || new Date(),
                        sampleSize: result.sampleSize,
                        verifiedSales: [], // Individual sales are now in individual_sales table
                        fetchedAt: new Date(),
                        cardType: result.cardType || 'base',
                        inferredYear: result.inferredFirstBowmanYear,
                    };

                    // Save market summary to current_market table
                    upsertCurrentMarket(marketData);
                    refreshed++;

                    console.log(`[Collection API] ✓ ${playerName}: Avg $${result.averagePrice}, ${result.salesInserted} new sales stored [${result.inferredFirstBowmanYear || '?'}]`);
                } else {
                    failed++;
                    errors.push({
                        playerName,
                        error: result.error?.message || 'No valid sales found',
                    });
                }

                // Rate limiting between requests
                if (playersToRefresh.indexOf(playerName) < playersToRefresh.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            } catch (err) {
                failed++;
                errors.push({
                    playerName,
                    error: err instanceof Error ? err.message : 'Unknown error',
                });
            }
        }

        console.log(`[Collection API] Refresh complete: ${refreshed} success, ${failed} failed`);

        // Record price snapshots for all refreshed players
        if (refreshed > 0) {
            const snapshotsRecorded = recordAllPriceSnapshots();
            console.log(`[Collection API] Recorded ${snapshotsRecorded} price snapshots`);

            // Invalidate cache so fresh data is served
            apiCache.invalidate(/collection/);
            apiCache.invalidate(/sales/);
            console.log('[Collection API] Cache invalidated');
        }

        const response: RefreshResponse = {
            success: true,
            refreshed,
            failed,
            errors: errors.length > 0 ? errors : undefined,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('[Collection API] Error:', error);

        return NextResponse.json({
            success: false,
            refreshed: 0,
            failed: 0,
            error: {
                code: 'REFRESH_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error occurred',
            },
        }, { status: 500 });
    }
}
