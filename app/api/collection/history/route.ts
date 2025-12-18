/**
 * =============================================================================
 * PRICE HISTORY API ROUTE
 * =============================================================================
 * 
 * API route for fetching price history data for tracked cards.
 * 
 * Endpoints:
 * - GET /api/collection/history - Get price history for a player or all players
 * - GET /api/collection/history?player=name - Get history for specific player
 * - GET /api/collection/history?days=30 - Get history for last N days
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    initializeDatabase,
    getPriceHistory,
    getAllPriceHistory,
    getLatestSnapshotDate,
    getPriceChange,
    type PriceHistoryEntry,
} from '@/lib/collection-database';

// =============================================================================
// TYPES
// =============================================================================

interface HistoryResponse {
    success: boolean;
    data?: {
        player?: string;
        history: PriceHistoryEntry[];
        latestSnapshot: string | null;
        summary?: {
            startPrice: number;
            endPrice: number;
            change: number;
            percentChange: number;
        };
    };
    error?: {
        code: string;
        message: string;
    };
}

interface AllHistoryResponse {
    success: boolean;
    data?: {
        players: {
            [key: string]: {
                history: PriceHistoryEntry[];
                summary?: {
                    startPrice: number;
                    endPrice: number;
                    change: number;
                    percentChange: number;
                };
            };
        };
        latestSnapshot: string | null;
        totalPlayers: number;
    };
    error?: {
        code: string;
        message: string;
    };
}

// =============================================================================
// GET HANDLER - Fetch Price History
// =============================================================================

export async function GET(request: NextRequest) {
    console.log('[History API] GET /api/collection/history');

    try {
        initializeDatabase();

        const searchParams = request.nextUrl.searchParams;
        const player = searchParams.get('player')?.toLowerCase().trim();
        const days = parseInt(searchParams.get('days') || '90', 10);

        const latestSnapshot = getLatestSnapshotDate();

        if (player) {
            // Get history for a specific player
            const history = getPriceHistory(player, days);

            let summary = null;
            if (history.length >= 2) {
                const startDate = history[0].snapshotDate;
                const endDate = history[history.length - 1].snapshotDate;
                summary = getPriceChange(player, startDate, endDate);
            }

            const response: HistoryResponse = {
                success: true,
                data: {
                    player,
                    history,
                    latestSnapshot,
                    summary: summary || undefined,
                },
            };

            return NextResponse.json(response, {
                headers: {
                    'Cache-Control': 'private, max-age=300',
                },
            });
        } else {
            // Get history for all players
            const historyMap = getAllPriceHistory(days);

            const players: AllHistoryResponse['data'] = {
                players: {},
                latestSnapshot,
                totalPlayers: historyMap.size,
            };

            for (const [playerName, history] of historyMap) {
                let summary = null;
                if (history.length >= 2) {
                    const startDate = history[0].snapshotDate;
                    const endDate = history[history.length - 1].snapshotDate;
                    summary = getPriceChange(playerName, startDate, endDate);
                }

                players.players[playerName] = {
                    history,
                    summary: summary || undefined,
                };
            }

            return NextResponse.json({
                success: true,
                data: players,
            }, {
                headers: {
                    'Cache-Control': 'private, max-age=300',
                },
            });
        }
    } catch (error) {
        console.error('[History API] Error:', error);

        return NextResponse.json({
            success: false,
            error: {
                code: 'HISTORY_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error occurred',
            },
        }, { status: 500 });
    }
}
