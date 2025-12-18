"use client";

/**
 * =============================================================================
 * COLLECTION CARD COMPONENT
 * =============================================================================
 * 
 * Premium card component displaying tracked player data with price deltas.
 * Features glassmorphism design, smooth animations, and hover effects.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    TrendingUp,
    TrendingDown,
    Clock,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Calendar,
    Hash,
    DollarSign,
    BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrackedCard, CompSale } from "@/lib/collection-types";
import { PriceDeltaBadge, CompactDelta } from "./price-delta-badge";

// =============================================================================
// TYPES
// =============================================================================

interface CollectionCardProps {
    /** Tracked card data */
    card: TrackedCard;

    /** Callback when refresh is requested */
    onRefresh?: (playerName: string) => void;

    /** Whether refresh is in progress */
    isRefreshing?: boolean;

    /** Card layout variant */
    variant?: "compact" | "expanded";

    /** Additional classes */
    className?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format currency value
 */
function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

/**
 * Format date in relative terms
 * Handles both Date objects and ISO date strings (from JSON serialization)
 */
function formatRelativeDate(date: Date | string): string {
    // Convert string to Date if needed (handles JSON serialization)
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Safety check for invalid dates
    if (isNaN(dateObj.getTime())) {
        return "Unknown";
    }

    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
}

/**
 * Get player initials for avatar fallback
 */
function getInitials(name: string): string {
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

/**
 * Generate gradient based on ranking
 */
function getRankingGradient(ranking?: number): string {
    if (!ranking) return "from-zinc-600 to-zinc-700";
    if (ranking <= 10) return "from-amber-500 to-orange-600";
    if (ranking <= 25) return "from-purple-500 to-pink-600";
    if (ranking <= 50) return "from-blue-500 to-cyan-600";
    if (ranking <= 100) return "from-emerald-500 to-teal-600";
    return "from-zinc-500 to-zinc-600";
}

// =============================================================================
// ANIMATION VARIANTS - Simplified for performance
// =============================================================================

const cardVariants = {
    hidden: {
        opacity: 0,
        y: 10,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.2,
            ease: [0.4, 0, 0.2, 1] as const, // easeOut cubic bezier
        },
    },
    hover: {
        y: -2,
        transition: {
            duration: 0.15,
        },
    },
};

const expandVariants = {
    collapsed: {
        height: 0,
        opacity: 0,
        transition: {
            duration: 0.15,
        },
    },
    expanded: {
        height: "auto",
        opacity: 1,
        transition: {
            duration: 0.2,
        },
    },
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface SaleRowProps {
    sale: CompSale;
    index: number;
}

// Memoized sale row component with CSS transitions instead of Framer Motion
const SaleRow: React.FC<SaleRowProps> = React.memo(({ sale, index }) => (
    <div
        className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group animate-fade-in"
        style={{ animationDelay: `${index * 30}ms` }}
    >
        <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground/80 truncate" title={sale.title}>
                {sale.title}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{formatRelativeDate(new Date(sale.saleDate))}</span>
                <span className="opacity-50">•</span>
                <span className={cn(
                    sale.saleType === "Auction" && "text-blue-400",
                    sale.saleType === "Best Offer" && "text-purple-400",
                    sale.saleType === "Buy It Now" && "text-emerald-400",
                )}>
                    {sale.saleType}
                </span>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground tabular-nums">
                {formatCurrency(sale.salePrice)}
            </span>
            <a
                href={sale.url}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            >
                <ExternalLink size={14} />
            </a>
        </div>
    </div>
));
SaleRow.displayName = 'SaleRow';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CollectionCard: React.FC<CollectionCardProps> = ({
    card,
    onRefresh,
    isRefreshing = false,
    variant = "compact",
    className,
}) => {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(variant === "expanded");

    const hasMarketData = !!card.currentMarket;
    const hasDelta = !!card.priceDelta;

    const handleViewChart = () => {
        router.push(`/${encodeURIComponent(card.normalizedPlayerName)}`);
    };

    return (
        <div
            className={cn(
                // Base styles
                "relative overflow-hidden rounded-2xl",
                "border border-white/10",
                // Solid background instead of glassmorphism (much faster)
                "bg-zinc-900/90",
                // Lighter shadow
                "shadow-lg shadow-black/10",
                // CSS containment for rendering optimization
                "contain-layout contain-paint",
                // Stale indicator
                card.isStale && "ring-1 ring-amber-500/30",
                // Hover effect using CSS only (no motion)
                "transition-transform duration-150 hover:-translate-y-0.5",
                className
            )}
        >
            {/* Stale data warning strip */}
            {card.isStale && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />
            )}

            {/* Header Section */}
            <div className="p-4 pb-3">
                <div className="flex items-start gap-3">
                    {/* Avatar with ranking gradient */}
                    <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        "text-white font-bold text-lg",
                        "bg-gradient-to-br shadow-lg",
                        getRankingGradient(card.hobbyRanking)
                    )}>
                        {card.hobbyRanking ? (
                            <span className="flex flex-col items-center leading-none">
                                <span className="text-[10px] opacity-70">#</span>
                                <span className="text-sm">{card.hobbyRanking}</span>
                            </span>
                        ) : (
                            <span className="text-sm">{getInitials(card.playerName)}</span>
                        )}
                    </div>

                    {/* Name and metadata */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg text-foreground truncate capitalize">
                            {card.playerName}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{card.releaseYear} Bowman Chrome</span>
                            {card.isStale && (
                                <span className="flex items-center gap-1 text-amber-400 text-xs">
                                    <Clock size={12} />
                                    <span>Stale</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                        {/* View Chart button */}
                        <button
                            onClick={handleViewChart}
                            className={cn(
                                "p-2 rounded-lg transition-all duration-200",
                                "text-muted-foreground hover:text-foreground",
                                "hover:bg-white/10"
                            )}
                            title="View sales chart"
                        >
                            <BarChart3 size={18} />
                        </button>

                        {/* Refresh button */}
                        {onRefresh && (
                            <button
                                onClick={() => onRefresh(card.normalizedPlayerName)}
                                disabled={isRefreshing}
                                className={cn(
                                    "p-2 rounded-lg transition-all duration-200",
                                    "text-muted-foreground hover:text-foreground",
                                    "hover:bg-white/10",
                                    isRefreshing && "animate-spin text-primary"
                                )}
                                title="Refresh market data"
                            >
                                <RefreshCw size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Price Section */}
            <div className="px-4 pb-3">
                <div className="grid grid-cols-2 gap-4">
                    {/* Article Price */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar size={12} />
                            <span>Article Price</span>
                        </div>
                        <div className="text-xl font-bold text-foreground tabular-nums">
                            {formatCurrency(card.baseline.originalPrice)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {formatRelativeDate(card.baseline.articleDate)}
                        </div>
                    </div>

                    {/* Current Price */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <DollarSign size={12} />
                            <span>Current Avg</span>
                            {hasMarketData && card.currentMarket!.cardType === 'refractor' && (
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                    /499
                                </span>
                            )}
                        </div>
                        {hasMarketData ? (
                            <>
                                <div className="text-xl font-bold text-foreground tabular-nums">
                                    {formatCurrency(card.currentMarket!.averagePrice)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {formatRelativeDate(card.currentMarket!.lastSaleDate)}
                                </div>
                            </>
                        ) : (
                            <div className="text-lg text-muted-foreground">—</div>
                        )}
                    </div>
                </div>

                {/* Delta Badge */}
                {hasDelta && (
                    <div className="mt-3">
                        <PriceDeltaBadge
                            absoluteChange={card.priceDelta!.absoluteChange}
                            percentageChange={card.priceDelta!.percentageChange}
                            direction={card.priceDelta!.direction}
                            magnitude={card.priceDelta!.magnitude}
                            size="md"
                        />
                    </div>
                )}
            </div>

            {/* Expandable Sales Section */}
            {hasMarketData && card.currentMarket!.verifiedSales.length > 0 && (
                <>
                    {/* Expand toggle */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={cn(
                            "w-full px-4 py-2 flex items-center justify-between",
                            "text-sm text-muted-foreground",
                            "hover:bg-white/5 transition-colors",
                            "border-t border-white/10"
                        )}
                    >
                        <span>Recent Sales ({card.currentMarket!.verifiedSales.length})</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {/* Expanded content */}
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                variants={expandVariants}
                                initial="collapsed"
                                animate="expanded"
                                exit="collapsed"
                                className="overflow-hidden"
                            >
                                <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
                                    {card.currentMarket!.verifiedSales.slice(0, 5).map((sale, idx) => (
                                        <SaleRow key={sale.url} sale={sale} index={idx} />
                                    ))}
                                    {card.currentMarket!.verifiedSales.length > 5 && (
                                        <div className="text-center text-xs text-muted-foreground py-2">
                                            +{card.currentMarket!.verifiedSales.length - 5} more sales
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/10" />
        </div>
    );
};

// =============================================================================
// EXPORTS
// =============================================================================

// Memoized for performance - prevents re-renders when parent updates
const MemoizedCollectionCard = React.memo(CollectionCard);
MemoizedCollectionCard.displayName = 'CollectionCard';

export default MemoizedCollectionCard;
