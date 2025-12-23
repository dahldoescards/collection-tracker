/**
 * =============================================================================
 * FAVORITES API - User Favorites Management
 * =============================================================================
 * 
 * API endpoints for managing user's favorite players.
 * Requires authentication.
 * 
 * Endpoints:
 * - GET /api/favorites - Get user's favorites
 * - POST /api/favorites - Add a favorite
 * - DELETE /api/favorites - Remove a favorite
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
    getUserFavorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    getFavoriteCount,
} from '@/lib/auth-database';

// =============================================================================
// TYPES
// =============================================================================

interface FavoritesResponse {
    success: boolean;
    data?: {
        favorites: string[];
        count: number;
    };
    error?: {
        code: string;
        message: string;
    };
}

interface ToggleResponse {
    success: boolean;
    isFavorite?: boolean;
    error?: {
        code: string;
        message: string;
    };
}

// =============================================================================
// GET HANDLER - Get User's Favorites
// =============================================================================

export async function GET() {
    console.log('[Favorites API] GET /api/favorites');

    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json<FavoritesResponse>({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Please log in to view favorites',
                },
            }, { status: 401 });
        }

        const favorites = getUserFavorites(session.user.id);
        const count = getFavoriteCount(session.user.id);

        return NextResponse.json<FavoritesResponse>({
            success: true,
            data: {
                favorites,
                count,
            },
        });

    } catch (error) {
        console.error('[Favorites API] Error:', error);

        return NextResponse.json<FavoritesResponse>({
            success: false,
            error: {
                code: 'FETCH_ERROR',
                message: 'Failed to fetch favorites',
            },
        }, { status: 500 });
    }
}

// =============================================================================
// POST HANDLER - Add/Toggle Favorite
// =============================================================================

export async function POST(request: NextRequest) {
    console.log('[Favorites API] POST /api/favorites');

    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json<ToggleResponse>({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Please log in to manage favorites',
                },
            }, { status: 401 });
        }

        const body = await request.json();
        const { playerName, toggle } = body as { playerName: string; toggle?: boolean };

        if (!playerName || typeof playerName !== 'string') {
            return NextResponse.json<ToggleResponse>({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Player name is required',
                },
            }, { status: 400 });
        }

        const normalizedName = playerName.toLowerCase().trim();

        if (toggle) {
            // Toggle favorite status
            const isFavorite = toggleFavorite(session.user.id, normalizedName);
            console.log(`[Favorites API] Toggled ${normalizedName}: ${isFavorite ? 'added' : 'removed'}`);

            return NextResponse.json<ToggleResponse>({
                success: true,
                isFavorite,
            });
        } else {
            // Add favorite
            addFavorite(session.user.id, normalizedName);
            console.log(`[Favorites API] Added favorite: ${normalizedName}`);

            return NextResponse.json<ToggleResponse>({
                success: true,
                isFavorite: true,
            });
        }

    } catch (error) {
        console.error('[Favorites API] Error:', error);

        return NextResponse.json<ToggleResponse>({
            success: false,
            error: {
                code: 'ADD_ERROR',
                message: 'Failed to add favorite',
            },
        }, { status: 500 });
    }
}

// =============================================================================
// DELETE HANDLER - Remove Favorite
// =============================================================================

export async function DELETE(request: NextRequest) {
    console.log('[Favorites API] DELETE /api/favorites');

    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json<ToggleResponse>({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Please log in to manage favorites',
                },
            }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const playerName = searchParams.get('player');

        if (!playerName) {
            return NextResponse.json<ToggleResponse>({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Player name is required',
                },
            }, { status: 400 });
        }

        const normalizedName = playerName.toLowerCase().trim();
        const removed = removeFavorite(session.user.id, normalizedName);

        if (removed) {
            console.log(`[Favorites API] Removed favorite: ${normalizedName}`);
        }

        return NextResponse.json<ToggleResponse>({
            success: true,
            isFavorite: false,
        });

    } catch (error) {
        console.error('[Favorites API] Error:', error);

        return NextResponse.json<ToggleResponse>({
            success: false,
            error: {
                code: 'DELETE_ERROR',
                message: 'Failed to remove favorite',
            },
        }, { status: 500 });
    }
}
