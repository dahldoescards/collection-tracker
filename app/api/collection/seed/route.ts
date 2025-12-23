/**
 * =============================================================================
 * SEED API - Direct Player Seeding Endpoint
 * =============================================================================
 * 
 * API route for directly adding players to the database.
 * Requires admin authentication via bearer token.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
    initializeDatabase,
    bulkInsertBaselinePrices,
} from '@/lib/collection-database';
import { BaselinePrice } from '@/lib/collection-types';

// =============================================================================
// TYPES
// =============================================================================

interface PlayerSeed {
    playerName: string;
    price: number;
    releaseYear?: number;
    notes?: string;
}

interface SeedRequest {
    players: PlayerSeed[];
    articleDate?: string;
    articleSource?: string;
}

interface SeedResponse {
    success: boolean;
    seeded?: number;
    players?: string[];
    error?: {
        code: string;
        message: string;
    };
}

// =============================================================================
// POST HANDLER - Seed Players
// =============================================================================

export async function POST(request: NextRequest) {
    console.log('[Seed API] POST /api/collection/seed');

    // Check for admin auth (use CRON_SECRET as admin token)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token !== process.env.CRON_SECRET) {
        return NextResponse.json<SeedResponse>({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or missing authorization token',
            },
        }, { status: 401 });
    }

    try {
        const body = await request.json() as SeedRequest;

        if (!body.players?.length) {
            return NextResponse.json<SeedResponse>({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Must provide players array',
                },
            }, { status: 400 });
        }

        const articleDate = body.articleDate
            ? new Date(body.articleDate)
            : new Date();
        const articleSource = body.articleSource || `api-seed-${new Date().toISOString().split('T')[0]}`;

        // Initialize database
        initializeDatabase();

        // Create baseline price records
        const prices: BaselinePrice[] = body.players.map(player => ({
            id: uuidv4(),
            playerName: player.playerName,
            normalizedPlayerName: player.playerName.toLowerCase(),
            originalPrice: player.price,
            articleDate,
            articleSource,
            releaseYear: player.releaseYear || 2025,
            notes: player.notes || undefined,
            createdAt: new Date(),
        }));

        // Insert into database
        const count = bulkInsertBaselinePrices(prices);

        console.log(`[Seed API] Seeded ${count} players`);

        return NextResponse.json<SeedResponse>({
            success: true,
            seeded: count,
            players: body.players.map(p => p.playerName),
        });

    } catch (error) {
        console.error('[Seed API] Error:', error);

        return NextResponse.json<SeedResponse>({
            success: false,
            error: {
                code: 'SEED_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error occurred',
            },
        }, { status: 500 });
    }
}
