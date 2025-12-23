"use client";

/**
 * =============================================================================
 * COLLECTION GRID COMPONENT
 * =============================================================================
 * 
 * Main dashboard component integrating the Infinite Grid with tracked cards.
 * Features filtering, sorting, statistics panel, and mass refresh functionality.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    SlidersHorizontal,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    ArrowUpDown,
    LayoutGrid,
    List,
    Filter,
    X,
    ChevronDown,
    AlertCircle,
    Clock,
    DollarSign,
    Hash,
    Zap,
    Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { InfiniteGrid } from "@/components/ui/infinite-grid";
import { CollectionCard } from "./collection-card";
import { PriceDeltaBadge, CompactDelta } from "./price-delta-badge";
import { UserMenu } from "./user-menu";
import {
    TrackedCard,
    DashboardStats,
    FilterOptions,
    SortOption,
} from "@/lib/collection-types";

// =============================================================================
// TYPES
// =============================================================================

interface CollectionGridProps {
    /** Array of tracked cards to display */
    cards: TrackedCard[];

    /** Dashboard statistics */
    stats: DashboardStats;

    /** Callback when card refresh is requested */
    onRefreshCard?: (playerName: string) => Promise<void>;

    /** Callback when bulk refresh is requested */
    onRefreshAll?: () => Promise<void>;

    /** Whether a refresh operation is in progress */
    isRefreshing?: boolean;

    /** Which cards are currently being refreshed */
    refreshingCards?: Set<string>;

    /** User's favorite player names */
    favorites?: string[];

    /** Additional classes */
    className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SORT_OPTIONS: { value: SortOption; label: string; icon?: React.ReactNode }[] = [
    { value: "ranking-asc", label: "Ranking (High → Low)", icon: <Hash size={14} /> },
    { value: "ranking-desc", label: "Ranking (Low → High)", icon: <Hash size={14} /> },
    { value: "delta-desc", label: "Price ↑ First", icon: <TrendingUp size={14} /> },
    { value: "delta-asc", label: "Price ↓ First", icon: <TrendingDown size={14} /> },
    { value: "price-desc", label: "Most Expensive", icon: <DollarSign size={14} /> },
    { value: "price-asc", label: "Least Expensive", icon: <DollarSign size={14} /> },
    { value: "player-asc", label: "Name (A → Z)" },
    { value: "player-desc", label: "Name (Z → A)" },
];

const DEFAULT_FILTERS: FilterOptions = {
    searchQuery: "",
    deltaDirection: "all",
    showStaleOnly: false,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Sort cards based on selected sort option
 */
function sortCards(cards: TrackedCard[], sortOption: SortOption): TrackedCard[] {
    const sorted = [...cards];

    switch (sortOption) {
        case "ranking-asc":
            return sorted.sort((a, b) => (a.hobbyRanking || 999) - (b.hobbyRanking || 999));
        case "ranking-desc":
            return sorted.sort((a, b) => (b.hobbyRanking || 0) - (a.hobbyRanking || 0));
        case "delta-desc":
            return sorted.sort((a, b) =>
                (b.priceDelta?.percentageChange || 0) - (a.priceDelta?.percentageChange || 0)
            );
        case "delta-asc":
            return sorted.sort((a, b) =>
                (a.priceDelta?.percentageChange || 0) - (b.priceDelta?.percentageChange || 0)
            );
        case "price-desc":
            return sorted.sort((a, b) =>
                (b.currentMarket?.averagePrice || b.baseline.originalPrice) -
                (a.currentMarket?.averagePrice || a.baseline.originalPrice)
            );
        case "price-asc":
            return sorted.sort((a, b) =>
                (a.currentMarket?.averagePrice || a.baseline.originalPrice) -
                (b.currentMarket?.averagePrice || b.baseline.originalPrice)
            );
        case "player-asc":
            return sorted.sort((a, b) => a.playerName.localeCompare(b.playerName));
        case "player-desc":
            return sorted.sort((a, b) => b.playerName.localeCompare(a.playerName));
        default:
            return sorted;
    }
}

/**
 * Filter cards based on filter options
 */
function filterCards(cards: TrackedCard[], filters: FilterOptions): TrackedCard[] {
    return cards.filter(card => {
        // Search query filter
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            if (!card.playerName.toLowerCase().includes(query)) {
                return false;
            }
        }

        // Delta direction filter
        if (filters.deltaDirection && filters.deltaDirection !== "all") {
            if (!card.priceDelta || card.priceDelta.direction !== filters.deltaDirection) {
                return false;
            }
        }

        // Min/max delta filters
        if (filters.minDelta !== undefined && card.priceDelta) {
            if (card.priceDelta.percentageChange < filters.minDelta) {
                return false;
            }
        }
        if (filters.maxDelta !== undefined && card.priceDelta) {
            if (card.priceDelta.percentageChange > filters.maxDelta) {
                return false;
            }
        }

        // Stale only filter
        if (filters.showStaleOnly && !card.isStale) {
            return false;
        }

        // Release year filter
        if (filters.releaseYear && card.releaseYear !== filters.releaseYear) {
            return false;
        }

        return true;
    });
}

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring" as const,
            stiffness: 300,
            damping: 25,
        },
    },
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface StatsCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: "up" | "down" | "neutral";
    className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ label, value, icon, trend, className }) => (
    <motion.div
        className={cn(
            "relative overflow-hidden rounded-xl p-4",
            "bg-gradient-to-br from-white/10 to-white/5",
            "border border-white/10",
            "backdrop-blur-sm",
            className
        )}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
        <div className="flex items-start justify-between">
            <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={cn(
                    "text-2xl font-bold mt-1 tabular-nums",
                    trend === "up" && "text-emerald-400",
                    trend === "down" && "text-rose-400",
                    !trend && "text-foreground"
                )}>
                    {value}
                </p>
            </div>
            <div className={cn(
                "p-2 rounded-lg bg-white/10",
                trend === "up" && "text-emerald-400",
                trend === "down" && "text-rose-400",
                !trend && "text-muted-foreground"
            )}>
                {icon}
            </div>
        </div>
    </motion.div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CollectionGrid: React.FC<CollectionGridProps> = ({
    cards,
    stats,
    onRefreshCard,
    onRefreshAll,
    isRefreshing = false,
    refreshingCards = new Set(),
    favorites = [],
    className,
}) => {
    // State
    const [sortOption, setSortOption] = useState<SortOption>("ranking-asc");
    const [filters, setFilters] = useState<FilterOptions>(DEFAULT_FILTERS);
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    // Memoized filtered and sorted cards
    const processedCards = useMemo(() => {
        let filtered = filterCards(cards, filters);
        // Apply favorites filter
        if (showFavoritesOnly && favorites.length > 0) {
            filtered = filtered.filter(card =>
                favorites.includes(card.normalizedPlayerName)
            );
        }
        return sortCards(filtered, sortOption);
    }, [cards, filters, sortOption, showFavoritesOnly, favorites]);

    // Handlers
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, searchQuery: e.target.value }));
    }, []);

    const handleClearSearch = useCallback(() => {
        setFilters(prev => ({ ...prev, searchQuery: "" }));
    }, []);

    const handleDirectionFilter = useCallback((dir: FilterOptions["deltaDirection"]) => {
        setFilters(prev => ({ ...prev, deltaDirection: dir }));
    }, []);

    const handleToggleStaleOnly = useCallback(() => {
        setFilters(prev => ({ ...prev, showStaleOnly: !prev.showStaleOnly }));
    }, []);

    const handleResetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    const hasActiveFilters = filters.searchQuery ||
        filters.deltaDirection !== "all" ||
        filters.showStaleOnly ||
        showFavoritesOnly;

    return (
        <InfiniteGrid>
            <div className={cn("w-full max-w-7xl mx-auto px-4 py-8", className)}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 flex items-start justify-between gap-4"
                >
                    <div>
                        <h1 className="text-4xl font-bold text-foreground mb-2">
                            Collection Tracker
                        </h1>
                        <p className="text-muted-foreground">
                            Track price movements for 1st Bowman Chrome Base Autos
                        </p>
                    </div>
                    <UserMenu favoriteCount={favorites.length} />
                </motion.div>

                {/* Stats Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
                >
                    <StatsCard
                        label="Total Cards"
                        value={stats.totalCards}
                        icon={<LayoutGrid size={20} />}
                    />
                    <StatsCard
                        label="Trending Up"
                        value={stats.cardsUp}
                        icon={<TrendingUp size={20} />}
                        trend="up"
                    />
                    <StatsCard
                        label="Trending Down"
                        value={stats.cardsDown}
                        icon={<TrendingDown size={20} />}
                        trend="down"
                    />
                    <StatsCard
                        label="Avg Change"
                        value={`${stats.averageChange > 0 ? "+" : ""}${stats.averageChange.toFixed(1)}%`}
                        icon={<Zap size={20} />}
                        trend={stats.averageChange > 0 ? "up" : stats.averageChange < 0 ? "down" : "neutral"}
                    />
                </motion.div>

                {/* Top Movers */}
                {(stats.topGainer || stats.topLoser) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-wrap gap-4 mb-8"
                    >
                        {stats.topGainer && (
                            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <TrendingUp size={16} className="text-emerald-400" />
                                <span className="text-sm text-foreground">
                                    <span className="font-medium capitalize">{stats.topGainer.playerName}</span>
                                    <span className="text-emerald-400 ml-2">
                                        +{stats.topGainer.percentageChange.toFixed(1)}%
                                    </span>
                                </span>
                            </div>
                        )}
                        {stats.topLoser && (
                            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-rose-500/10 border border-rose-500/20">
                                <TrendingDown size={16} className="text-rose-400" />
                                <span className="text-sm text-foreground">
                                    <span className="font-medium capitalize">{stats.topLoser.playerName}</span>
                                    <span className="text-rose-400 ml-2">
                                        {stats.topLoser.percentageChange.toFixed(1)}%
                                    </span>
                                </span>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Controls Bar */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="flex flex-wrap items-center gap-4 mb-6"
                >
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search players..."
                            value={filters.searchQuery}
                            onChange={handleSearchChange}
                            className={cn(
                                "w-full pl-10 pr-10 py-2 rounded-xl",
                                "bg-white/10 border border-white/10",
                                "text-foreground placeholder:text-muted-foreground",
                                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                                "transition-all duration-200"
                            )}
                        />
                        {filters.searchQuery && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative">
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as SortOption)}
                            className={cn(
                                "appearance-none pl-4 pr-10 py-2 rounded-xl",
                                "bg-white/10 border border-white/10",
                                "text-foreground",
                                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                                "cursor-pointer"
                            )}
                        >
                            {SORT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value} className="bg-background">
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Filter Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl",
                            "border transition-all duration-200",
                            showFilters || hasActiveFilters
                                ? "bg-primary/20 border-primary/50 text-primary"
                                : "bg-white/10 border-white/10 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <SlidersHorizontal size={18} />
                        <span className="hidden sm:inline">Filters</span>
                        {hasActiveFilters && (
                            <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                    </button>

                    {/* View Toggle */}
                    <div className="flex items-center rounded-xl border border-white/10 overflow-hidden">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={cn(
                                "p-2 transition-colors",
                                viewMode === "grid" ? "bg-white/20 text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={cn(
                                "p-2 transition-colors",
                                viewMode === "list" ? "bg-white/20 text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <List size={18} />
                        </button>
                    </div>

                    {/* Refresh All */}
                    {onRefreshAll && (
                        <button
                            onClick={onRefreshAll}
                            disabled={isRefreshing}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl",
                                "bg-primary text-primary-foreground",
                                "hover:bg-primary/90 transition-colors",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">
                                {isRefreshing ? "Refreshing..." : "Refresh All"}
                            </span>
                        </button>
                    )}
                </motion.div>

                {/* Filter Panel */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-6"
                        >
                            <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                                {/* Direction Filter */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Direction:</span>
                                    <div className="flex rounded-lg overflow-hidden border border-white/10">
                                        {(["all", "up", "down"] as const).map(dir => (
                                            <button
                                                key={dir}
                                                onClick={() => handleDirectionFilter(dir)}
                                                className={cn(
                                                    "px-3 py-1 text-sm transition-colors capitalize",
                                                    filters.deltaDirection === dir
                                                        ? "bg-white/20 text-foreground"
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                {dir}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Stale Only Toggle */}
                                <button
                                    onClick={handleToggleStaleOnly}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                                        filters.showStaleOnly
                                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                            : "bg-white/10 text-muted-foreground hover:text-foreground border border-white/10"
                                    )}
                                >
                                    <Clock size={14} />
                                    <span>Stale Only ({stats.staleCardCount})</span>
                                </button>

                                {/* Favorites Only Toggle */}
                                {favorites.length > 0 && (
                                    <button
                                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                                            showFavoritesOnly
                                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                                : "bg-white/10 text-muted-foreground hover:text-foreground border border-white/10"
                                        )}
                                    >
                                        <Heart size={14} className={showFavoritesOnly ? "fill-current" : ""} />
                                        <span>Favorites ({favorites.length})</span>
                                    </button>
                                )}

                                {/* Reset Filters */}
                                {hasActiveFilters && (
                                    <button
                                        onClick={() => {
                                            handleResetFilters();
                                            setShowFavoritesOnly(false);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X size={14} />
                                        <span>Reset</span>
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Results Count */}
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-muted-foreground">
                        Showing <span className="text-foreground font-medium">{processedCards.length}</span> of{" "}
                        <span className="text-foreground font-medium">{cards.length}</span> cards
                    </p>
                </div>

                {/* Cards Grid */}
                {processedCards.length > 0 ? (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className={cn(
                            viewMode === "grid"
                                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                                : "flex flex-col gap-4"
                        )}
                    >
                        {processedCards.map((card) => (
                            <motion.div key={card.id} variants={itemVariants}>
                                <CollectionCard
                                    card={card}
                                    onRefresh={onRefreshCard}
                                    isRefreshing={refreshingCards.has(card.normalizedPlayerName)}
                                    variant={viewMode === "list" ? "compact" : "compact"}
                                    isFavorite={favorites.includes(card.normalizedPlayerName)}
                                />
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-20 text-center"
                    >
                        <AlertCircle size={48} className="text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">
                            No cards found
                        </h3>
                        <p className="text-muted-foreground max-w-md">
                            {hasActiveFilters
                                ? "Try adjusting your filters or search query."
                                : "Add article prices from BigBobCards to start tracking."}
                        </p>
                        {hasActiveFilters && (
                            <button
                                onClick={handleResetFilters}
                                className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-foreground hover:bg-white/20 transition-colors"
                            >
                                Reset Filters
                            </button>
                        )}
                    </motion.div>
                )}
            </div>
        </InfiniteGrid>
    );
};

// =============================================================================
// EXPORTS
// =============================================================================

export default CollectionGrid;
