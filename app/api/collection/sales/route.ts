/**
 * =============================================================================
 * COLLECTION SALES API - Full Sales History from Database
 * =============================================================================
 * 
 * API route for fetching ALL individual sales data from the database.
 * Supports configurable date ranges for charting.
 * 
 * Now reads from unified individual_sales table populated by unified-scraper.
 * 
 * Endpoints:
 * - GET /api/collection/sales?player=name&days=90 - Get sales history
 * - POST /api/collection/sales - Trigger scrape and store for player(s)
 * 
 * @author Collection Tool
 * @version 3.0.0
 */

import { NextRequest, NextResponse } from 'next/server';

import {
    getPlayerSalesFromDb,
    getPlayerSalesCount,
    scrapeAndStorePlayer,
    scrapeMultiplePlayers,
} from '@/lib/unified-scraper';

import {
    initializeDatabase,
    getBaselinePrice,
    getAllTrackedCards,
} from '@/lib/collection-database';

// =============================================================================
// TYPES
// =============================================================================

interface SaleResponse {
    id: string;
    title: string;
    salePrice: number;
    saleDate: string;
    saleType: string;
    ebayUrl: string;
    releaseYear: number | null;
    daysAgo: number;
}

interface PlayerSalesResponse {
    playerName: string;
    normalizedPlayerName: string;

    // Baseline from BigBobCards
    baseline: {
        price: number;
        date: string;
        source: string;
    } | null;

    // Market stats from 5 most recent
    marketStats: {
        averagePrice: number;
        medianPrice: number;
        lastSalePrice: number;
        lastSaleDate: string;
        sampleSize: number;
    } | null;

    // Price delta
    priceDelta: {
        absoluteChange: number;
        percentageChange: number;
        direction: 'up' | 'down' | 'stable';
    } | null;

    // Year inference
    inferredYear: number | null;
    yearDistribution: Array<{
        year: number;
        totalListings: number;
        firstMentions: number;
        ratio: number;
    }>;

    // All sales in date range
    sales: SaleResponse[];
    totalSalesInDb: number;
}

interface ApiResponse {
    success: boolean;
    data?: {
        players: PlayerSalesResponse[];
        queryParams: {
            daysBack: number;
            playerFilter: string | null;
        };
    };
    error?: {
        code: string;
        message: string;
    };
}

interface RefreshResponse {
    success: boolean;
    results?: Array<{
        playerName: string;
        success: boolean;
        newSales: number;
        totalSales: number;
        error?: string;
    }>;
    error?: {
        code: string;
        message: string;
    };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateDaysAgo(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function calculatePriceDelta(
    baselinePrice: number,
    currentAverage: number
): { absoluteChange: number; percentageChange: number; direction: 'up' | 'down' | 'stable' } {
    const absoluteChange = currentAverage - baselinePrice;
    const percentageChange = (absoluteChange / baselinePrice) * 100;

    const threshold = 2; // 2% threshold for "stable"
    let direction: 'up' | 'down' | 'stable';

    if (percentageChange > threshold) {
        direction = 'up';
    } else if (percentageChange < -threshold) {
        direction = 'down';
    } else {
        direction = 'stable';
    }

    return {
        absoluteChange: Math.round(absoluteChange * 100) / 100,
        percentageChange: Math.round(percentageChange * 10) / 10,
        direction,
    };
}

// =============================================================================
// CACHE IMPORT
// =============================================================================

import { apiCache, cacheKeys, cacheTTL } from '@/lib/api-cache';

// =============================================================================
// GET HANDLER - Fetch Sales Data from Database
// =============================================================================

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    console.log('[Sales API] GET /api/collection/sales');

    try {
        // Parse query params
        const searchParams = request.nextUrl.searchParams;
        const playerFilter = searchParams.get('player')?.toLowerCase().trim() || null;
        const daysBack = parseInt(searchParams.get('days') || '90', 10);
        const skipCache = searchParams.get('fresh') === 'true';

        console.log(`[Sales API] Query: player=${playerFilter}, days=${daysBack}`);

        // Try cache first (only for single player queries)
        if (playerFilter && !skipCache) {
            const cacheKey = cacheKeys.playerSales(playerFilter, daysBack);
            const cached = apiCache.get<ApiResponse>(cacheKey);
            if (cached) {
                console.log(`[Sales API] Cache HIT - ${Date.now() - startTime}ms`);
                return NextResponse.json(cached, {
                    headers: {
                        'Cache-Control': 'private, max-age=60',
                        'X-Cache': 'HIT',
                        'X-Response-Time': `${Date.now() - startTime}ms`,
                    },
                });
            }
        }

        // Initialize database
        initializeDatabase();

        // Get all tracked players from baseline_prices if no filter
        let playerNames: string[] = [];

        if (playerFilter) {
            playerNames = [playerFilter];
        } else {
            const cards = getAllTrackedCards();
            playerNames = cards.map(c => c.normalizedPlayerName);
        }

        // Build response for each player
        const players: PlayerSalesResponse[] = [];

        for (const normalizedName of playerNames) {
            // Get sales from database with date filtering at DB level (efficient)
            const filteredSales = getPlayerSalesFromDb(normalizedName, undefined, undefined, daysBack);

            // Infer year from most common year in sales
            let inferredYear: number | null = null;
            const yearCounts = new Map<number, number>();
            for (const sale of filteredSales) {
                if (sale.releaseYear) {
                    yearCounts.set(sale.releaseYear, (yearCounts.get(sale.releaseYear) || 0) + 1);
                }
            }
            if (yearCounts.size > 0) {
                // Get earliest year with sales (1st Bowman)
                inferredYear = Math.min(...Array.from(yearCounts.keys()));
            }

            // Get 5 most recent for stats
            const recentSales = filteredSales.slice(0, 5);

            // Calculate market stats
            let marketStats = null;
            if (recentSales.length > 0) {
                const prices = recentSales.map(s => s.salePrice).sort((a, b) => a - b);
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                const mid = Math.floor(prices.length / 2);
                const median = prices.length % 2 !== 0
                    ? prices[mid]
                    : (prices[mid - 1] + prices[mid]) / 2;

                marketStats = {
                    averagePrice: Math.round(avg * 100) / 100,
                    medianPrice: Math.round(median * 100) / 100,
                    lastSalePrice: recentSales[0].salePrice,
                    lastSaleDate: recentSales[0].saleDate.toISOString(),
                    sampleSize: recentSales.length,
                };
            }

            // Get baseline
            const baseline = getBaselinePrice(normalizedName);

            // Calculate delta
            let priceDelta = null;
            if (baseline && marketStats) {
                priceDelta = calculatePriceDelta(baseline.originalPrice, marketStats.averagePrice);
            }

            // Get total count
            const totalSalesInDb = getPlayerSalesCount(normalizedName);

            players.push({
                playerName: baseline?.playerName || normalizedName,
                normalizedPlayerName: normalizedName,
                baseline: baseline ? {
                    price: baseline.originalPrice,
                    date: baseline.articleDate.toISOString(),
                    source: baseline.articleSource,
                } : null,
                marketStats,
                priceDelta,
                inferredYear,
                yearDistribution: [], // Simplified - not needed for charting
                sales: filteredSales.map(sale => ({
                    id: sale.id,
                    title: sale.title,
                    salePrice: sale.salePrice,
                    saleDate: sale.saleDate.toISOString(),
                    saleType: sale.saleType,
                    ebayUrl: sale.ebayUrl,
                    releaseYear: sale.releaseYear,
                    daysAgo: calculateDaysAgo(sale.saleDate),
                })),
                totalSalesInDb,
            });
        }

        // Filter out players with no sales and no baseline
        const playersWithData = players.filter(p => p.sales.length > 0 || p.baseline);

        console.log(`[Sales API] Returning ${playersWithData.length} players with ${players.reduce((a, p) => a + p.sales.length, 0)} total sales in ${Date.now() - startTime}ms`);

        const response: ApiResponse = {
            success: true,
            data: {
                players: playersWithData,
                queryParams: {
                    daysBack,
                    playerFilter,
                },
            },
        };

        // Cache the response (only for single player queries)
        if (playerFilter) {
            const cacheKey = cacheKeys.playerSales(playerFilter, daysBack);
            apiCache.set(cacheKey, response, cacheTTL.playerSales);
        }

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'private, max-age=60',
                'X-Cache': 'MISS',
                'X-Response-Time': `${Date.now() - startTime}ms`,
            },
        });
    } catch (error) {
        console.error('[Sales API] Error:', error);

        const response: ApiResponse = {
            success: false,
            error: {
                code: 'FETCH_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
        };

        return NextResponse.json(response, { status: 500 });
    }
}

// =============================================================================
// POST HANDLER - Trigger Scrape and Store
// =============================================================================

export async function POST(request: NextRequest) {
    console.log('[Sales API] POST /api/collection/sales');

    try {
        const body = await request.json();
        const { playerNames, refreshAll } = body as {
            playerNames?: string[];
            refreshAll?: boolean;
        };

        // Get list of players to refresh
        let playersToRefresh: string[] = [];

        if (playerNames && playerNames.length > 0) {
            playersToRefresh = playerNames;
        } else if (refreshAll) {
            initializeDatabase();
            const cards = getAllTrackedCards();
            playersToRefresh = cards.map(c => c.normalizedPlayerName);
        } else {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Provide playerNames array or refreshAll: true',
                },
            } as RefreshResponse, { status: 400 });
        }

        console.log(`[Sales API] Refreshing ${playersToRefresh.length} players`);

        // Scrape each player using unified scraper
        const results: RefreshResponse['results'] = [];

        for (const player of playersToRefresh) {
            console.log(`[Sales API] Scraping: ${player}`);

            const result = await scrapeAndStorePlayer(player);

            results.push({
                playerName: player,
                success: result.success,
                newSales: result.salesInserted,
                totalSales: result.salesTotal,
                error: result.error?.message,
            });

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // Summary
        const successful = results.filter(r => r.success).length;
        const totalNew = results.reduce((sum, r) => sum + r.newSales, 0);

        console.log(`[Sales API] Complete: ${successful}/${playersToRefresh.length} successful, ${totalNew} new sales`);

        return NextResponse.json({
            success: true,
            results,
        } as RefreshResponse);
    } catch (error) {
        console.error('[Sales API] Error:', error);

        return NextResponse.json({
            success: false,
            error: {
                code: 'SCRAPE_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
        } as RefreshResponse, { status: 500 });
    }
}
