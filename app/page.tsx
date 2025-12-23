"use client";

/**
 * =============================================================================
 * COLLECTION PAGE - Main Dashboard View
 * =============================================================================
 * 
 * Server Component wrapper for the Collection dashboard.
 * Handles data fetching and state management for the collection grid.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

import { CollectionGrid } from "@/components/collection-grid";
import { InfiniteGrid } from "@/components/ui/infinite-grid";
import {
    TrackedCard,
    DashboardStats,
    CollectionConfig,
} from "@/lib/collection-types";

// =============================================================================
// TYPES
// =============================================================================

interface CollectionData {
    cards: TrackedCard[];
    stats: DashboardStats;
    config: CollectionConfig;
}

interface ApiResponse {
    success: boolean;
    data?: CollectionData;
    error?: {
        code: string;
        message: string;
    };
}

interface RefreshResponse {
    success: boolean;
    refreshed: number;
    failed: number;
    errors?: { playerName: string; error: string }[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function CollectionPage() {
    // Auth session
    const { data: session } = useSession();

    // State
    const [data, setData] = useState<CollectionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshingCards, setRefreshingCards] = useState<Set<string>>(new Set());
    const [favorites, setFavorites] = useState<string[]>([]);

    // Fetch collection data
    const fetchData = useCallback(async () => {
        try {
            setError(null);
            const response = await fetch('/api/collection');
            const json: ApiResponse = await response.json();

            if (json.success && json.data) {
                setData(json.data);
            } else {
                setError(json.error?.message || 'Failed to fetch collection data');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch favorites
    const fetchFavorites = useCallback(async () => {
        if (!session?.user) {
            setFavorites([]);
            return;
        }
        try {
            const response = await fetch('/api/favorites');
            const json = await response.json();
            if (json.success && json.data) {
                setFavorites(json.data.favorites);
            }
        } catch (err) {
            console.error('Failed to fetch favorites:', err);
        }
    }, [session?.user]);

    // Initial load
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Load favorites when session changes
    useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

    // Refresh single card
    const handleRefreshCard = useCallback(async (playerName: string) => {
        setRefreshingCards(prev => new Set(prev).add(playerName));

        try {
            const response = await fetch('/api/collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerNames: [playerName] }),
            });

            const json: RefreshResponse = await response.json();

            if (json.success) {
                // Refetch data to get updated cards
                await fetchData();
            }
        } catch (err) {
            console.error('Failed to refresh card:', err);
        } finally {
            setRefreshingCards(prev => {
                const next = new Set(prev);
                next.delete(playerName);
                return next;
            });
        }
    }, [fetchData]);

    // Refresh all cards
    const handleRefreshAll = useCallback(async () => {
        setIsRefreshing(true);

        try {
            const response = await fetch('/api/collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshAll: true }),
            });

            const json: RefreshResponse = await response.json();

            if (json.success) {
                console.log(`Refreshed ${json.refreshed} cards, ${json.failed} failed`);
                await fetchData();
            }
        } catch (err) {
            console.error('Failed to refresh all:', err);
        } finally {
            setIsRefreshing(false);
        }
    }, [fetchData]);

    // Loading state
    if (isLoading) {
        return (
            <InfiniteGrid>
                <div className="w-full min-h-screen flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <div className="relative">
                            <Loader2 size={48} className="animate-spin text-primary" />
                            <div className="absolute inset-0 blur-xl bg-primary/20" />
                        </div>
                        <p className="text-muted-foreground">Loading collection data...</p>
                    </motion.div>
                </div>
            </InfiniteGrid>
        );
    }

    // Error state
    if (error) {
        return (
            <InfiniteGrid>
                <div className="w-full min-h-screen flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center gap-4 max-w-md text-center px-4"
                    >
                        <div className="p-4 rounded-full bg-destructive/20">
                            <AlertCircle size={48} className="text-destructive" />
                        </div>
                        <h2 className="text-xl font-semibold text-foreground">
                            Failed to Load Collection
                        </h2>
                        <p className="text-muted-foreground">{error}</p>
                        <button
                            onClick={fetchData}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl",
                                "bg-primary text-primary-foreground",
                                "hover:bg-primary/90 transition-colors"
                            )}
                        >
                            <RefreshCw size={18} />
                            <span>Retry</span>
                        </button>
                    </motion.div>
                </div>
            </InfiniteGrid>
        );
    }

    // Empty state
    if (!data || data.cards.length === 0) {
        return (
            <InfiniteGrid>
                <div className="w-full min-h-screen flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center gap-6 max-w-lg text-center px-4"
                    >
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10">
                            <h2 className="text-2xl font-bold text-foreground mb-4">
                                No Cards Being Tracked
                            </h2>
                            <p className="text-muted-foreground mb-6">
                                To start tracking price movements, add article prices
                                from BigBobCards using the parsing API.
                            </p>

                            <div className="text-left p-4 rounded-xl bg-black/20 font-mono text-sm overflow-x-auto">
                                <pre className="text-muted-foreground">
                                    {`POST /api/collection/parse
{
  "article": {
    "content": "Konnor Griffin - $45...",
    "dateString": "December 15, 2024",
    "source": "bigbobcards-dec-2024"
  }
}`}
                                </pre>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </InfiniteGrid>
        );
    }

    // Main view
    return (
        <CollectionGrid
            cards={data.cards}
            stats={data.stats}
            onRefreshCard={handleRefreshCard}
            onRefreshAll={handleRefreshAll}
            isRefreshing={isRefreshing}
            refreshingCards={refreshingCards}
            favorites={favorites}
        />
    );
}
