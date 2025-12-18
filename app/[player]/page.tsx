"use client";

/**
 * =============================================================================
 * PLAYER DETAIL PAGE V2 - Full Sales History with Configurable Date Range
 * =============================================================================
 * 
 * Shows individual player data with a line chart of ALL base auto sales
 * from the database. Supports configurable time windows.
 * 
 * @author Collection Tool
 * @version 2.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Calendar,
    DollarSign,
    ExternalLink,
    Loader2,
    Database,
    ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InfiniteGrid } from "@/components/ui/infinite-grid";

// =============================================================================
// TYPES
// =============================================================================

interface SaleDataPoint {
    id: string;
    title: string;
    salePrice: number;
    saleDate: string;
    saleType: string;
    ebayUrl: string;
    releaseYear: number | null;
    daysAgo: number;
}

interface PlayerData {
    playerName: string;
    normalizedPlayerName: string;
    baseline: {
        price: number;
        date: string;
        source: string;
    } | null;
    marketStats: {
        averagePrice: number;
        medianPrice: number;
        lastSalePrice: number;
        lastSaleDate: string;
        sampleSize: number;
    } | null;
    priceDelta: {
        absoluteChange: number;
        percentageChange: number;
        direction: "up" | "down" | "stable";
    } | null;
    inferredYear: number | null;
    yearDistribution: Array<{
        year: number;
        totalListings: number;
        firstMentions: number;
        ratio: number;
    }>;
    sales: SaleDataPoint[];
    totalSalesInDb: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DATE_RANGE_OPTIONS = [
    { value: 30, label: "30 Days" },
    { value: 60, label: "60 Days" },
    { value: 90, label: "90 Days" },
    { value: 180, label: "6 Months" },
    { value: 365, label: "1 Year" },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

function formatFullDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

// =============================================================================
// LINE CHART COMPONENT
// =============================================================================

interface LineChartProps {
    sales: SaleDataPoint[];
    baselinePrice: number | null;
    baselineDate: string | null;
}

const LineChart: React.FC<LineChartProps> = ({
    sales,
    baselinePrice,
    baselineDate,
}) => {
    const chartHeight = 350;
    const chartWidth = 900;
    const padding = { top: 40, right: 60, bottom: 60, left: 70 };

    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    // Sort all sales by date (oldest first) - for individual dots
    const sortedSales = useMemo(
        () => [...sales].sort((a, b) =>
            new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()
        ),
        [sales]
    );

    // Aggregate same-day sales for the LINE (average price per day)
    // This creates a smooth, connected line without visual artifacts
    const aggregatedByDate = useMemo(() => {
        const dateGroups = new Map<string, { total: number; count: number; date: string }>();

        for (const sale of sortedSales) {
            const dateKey = sale.saleDate.split('T')[0]; // Get just the date part
            const existing = dateGroups.get(dateKey);
            if (existing) {
                existing.total += sale.salePrice;
                existing.count += 1;
            } else {
                dateGroups.set(dateKey, { total: sale.salePrice, count: 1, date: sale.saleDate });
            }
        }

        return Array.from(dateGroups.entries())
            .map(([dateKey, data]) => ({
                dateKey,
                avgPrice: data.total / data.count,
                date: data.date,
                count: data.count,
            }))
            .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }, [sortedSales]);

    // Calculate Y scale based on price range
    const { minPrice, maxPrice } = useMemo(() => {
        if (sortedSales.length === 0) {
            return { minPrice: 0, maxPrice: 100 };
        }

        const prices = sortedSales.map((s) => s.salePrice);
        const priceMin = Math.min(...prices, baselinePrice || Infinity);
        const priceMax = Math.max(...prices, baselinePrice || 0);
        const priceRange = priceMax - priceMin;

        return {
            minPrice: priceMin - priceRange * 0.1,
            maxPrice: priceMax + priceRange * 0.1,
        };
    }, [sortedSales, baselinePrice]);

    // X scale for individual dots (index-based)
    const xScaleDots = useCallback((index: number) => {
        const maxIndex = Math.max(1, sortedSales.length - 1);
        return padding.left + (index / maxIndex) * innerWidth;
    }, [sortedSales.length, innerWidth, padding.left]);

    // X scale for aggregated line (date-based, evenly spaced)
    const xScaleLine = useCallback((index: number) => {
        const maxIndex = Math.max(1, aggregatedByDate.length - 1);
        return padding.left + (index / maxIndex) * innerWidth;
    }, [aggregatedByDate.length, innerWidth, padding.left]);

    // Y scale: price-based
    const yScale = useCallback((price: number) => {
        const range = maxPrice - minPrice || 1;
        return padding.top + innerHeight - ((price - minPrice) / range) * innerHeight;
    }, [minPrice, maxPrice, innerHeight, padding.top]);

    // Generate SMOOTH CURVED line path using cardinal spline interpolation
    const pathD = useMemo(() => {
        if (aggregatedByDate.length === 0) return "";
        if (aggregatedByDate.length === 1) {
            const x = xScaleLine(0);
            const y = yScale(aggregatedByDate[0].avgPrice);
            return `M ${x},${y}`;
        }

        // Get all points
        const points = aggregatedByDate.map((day, i) => ({
            x: xScaleLine(i),
            y: yScale(day.avgPrice),
        }));

        // Generate smooth curve using Catmull-Rom to Bézier conversion
        // Tension: 0.3 = rounder curves, 0.5 = balanced, 1 = tight to points
        const tension = 0.35;

        let path = `M ${points[0].x},${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];

            // Control points for cubic Bézier
            const cp1x = p1.x + (p2.x - p0.x) * tension;
            const cp1y = p1.y + (p2.y - p0.y) * tension;
            const cp2x = p2.x - (p3.x - p1.x) * tension;
            const cp2y = p2.y - (p3.y - p1.y) * tension;

            path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
        }

        return path;
    }, [aggregatedByDate, xScaleLine, yScale]);

    // Y-axis ticks
    const yTicks = useMemo(() => {
        const ticks = [];
        const step = (maxPrice - minPrice) / 5;
        for (let i = 0; i <= 5; i++) {
            ticks.push(minPrice + step * i);
        }
        return ticks;
    }, [minPrice, maxPrice]);

    // X-axis ticks (based on aggregated dates to match the line)
    const xTicks = useMemo(() => {
        if (aggregatedByDate.length === 0) return [];
        if (aggregatedByDate.length === 1) {
            return [{ index: 0, date: aggregatedByDate[0].date }];
        }

        // Target 5-6 evenly spaced ticks
        const numTicks = Math.min(6, aggregatedByDate.length);
        const totalDataPoints = aggregatedByDate.length;
        const step = (totalDataPoints - 1) / (numTicks - 1);

        const ticks: { index: number; date: string }[] = [];

        for (let i = 0; i < numTicks; i++) {
            const index = Math.round(i * step);
            // Ensure we don't add duplicate indices
            if (ticks.length === 0 || ticks[ticks.length - 1].index !== index) {
                ticks.push({ index, date: aggregatedByDate[index].date });
            }
        }

        return ticks;
    }, [aggregatedByDate]);

    if (sales.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                No sales data in selected date range
            </div>
        );
    }

    return (
        <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto"
            style={{ maxHeight: "450px" }}
        >
            {/* Grid lines */}
            {yTicks.map((tick, i) => (
                <line
                    key={`grid-${i}`}
                    x1={padding.left}
                    y1={yScale(tick)}
                    x2={chartWidth - padding.right}
                    y2={yScale(tick)}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="4,4"
                />
            ))}

            {/* Baseline reference line */}
            {baselinePrice && (
                <>
                    <line
                        x1={padding.left}
                        y1={yScale(baselinePrice)}
                        x2={chartWidth - padding.right}
                        y2={yScale(baselinePrice)}
                        stroke="rgba(234, 179, 8, 0.6)"
                        strokeWidth="2"
                        strokeDasharray="8,4"
                    />
                    <text
                        x={chartWidth - padding.right + 5}
                        y={yScale(baselinePrice) + 4}
                        fill="rgba(234, 179, 8, 0.9)"
                        fontSize="10"
                        fontWeight="500"
                    >
                        ${baselinePrice}
                    </text>
                </>
            )}

            {/* Area under line - uses aggregated data to match the line */}
            {aggregatedByDate.length > 1 && (
                <path
                    d={`${pathD} L ${xScaleLine(aggregatedByDate.length - 1)},${chartHeight - padding.bottom} L ${padding.left},${chartHeight - padding.bottom} Z`}
                    fill="url(#areaGradient)"
                    className="animate-fade-in"
                />
            )}

            {/* Line path - smooth curved line with glow effect for visibility */}
            <path
                d={pathD}
                fill="none"
                stroke="rgba(16, 185, 129, 0.3)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="blur(4px)"
            />
            <path
                d={pathD}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-draw-line"
                style={{
                    strokeDasharray: 3000,
                    strokeDashoffset: 0,
                }}
            />

            {/* Individual data points - optimized for large datasets */}
            {(() => {
                const salesCount = sortedSales.length;

                // Dynamic sizing based on data density
                const dotRadius = salesCount > 200 ? 2 : salesCount > 100 ? 2.5 : 3;
                const dotOpacity = salesCount > 200 ? 0.5 : salesCount > 100 ? 0.65 : 0.85;
                const showStroke = salesCount <= 100;

                return sortedSales.map((sale, i) => (
                    <g key={sale.id}>
                        <circle
                            cx={xScaleDots(i)}
                            cy={yScale(sale.salePrice)}
                            r={dotRadius}
                            fill={`rgba(16, 185, 129, ${dotOpacity})`}
                            stroke={showStroke ? "rgba(0,0,0,0.15)" : "none"}
                            strokeWidth={showStroke ? 0.5 : 0}
                            className="cursor-pointer"
                        />
                        <title>
                            {formatDate(sale.saleDate)}: {formatCurrency(sale.salePrice)}
                            {"\n"}{sale.saleType}
                        </title>
                    </g>
                ));
            })()}

            {/* Y-axis labels */}
            {yTicks.map((tick, i) => (
                <text
                    key={`y-label-${i}`}
                    x={padding.left - 10}
                    y={yScale(tick) + 4}
                    textAnchor="end"
                    fill="rgba(255,255,255,0.5)"
                    fontSize="10"
                >
                    ${tick.toFixed(0)}
                </text>
            ))}

            {/* X-axis labels */}
            {xTicks.map((tick, i) => (
                <text
                    key={`x-label-${i}`}
                    x={xScaleLine(tick.index)}
                    y={chartHeight - padding.bottom + 18}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.5)"
                    fontSize="10"
                >
                    {formatDate(tick.date)}
                </text>
            ))}

            {/* Axis labels */}
            <text
                x={padding.left - 45}
                y={chartHeight / 2}
                textAnchor="middle"
                fill="rgba(255,255,255,0.7)"
                fontSize="11"
                transform={`rotate(-90, ${padding.left - 45}, ${chartHeight / 2})`}
            >
                Sale Price (USD)
            </text>

            {/* Sales count indicator */}
            <text
                x={chartWidth - padding.right}
                y={padding.top - 10}
                textAnchor="end"
                fill="rgba(255,255,255,0.4)"
                fontSize="10"
            >
                {sales.length} sales
            </text>

            {/* Gradients */}
            <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(16, 185, 129, 0.25)" />
                    <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
                </linearGradient>
            </defs>
        </svg>
    );
};

// =============================================================================
// DATE RANGE SELECTOR
// =============================================================================

interface DateRangeSelectorProps {
    value: number;
    onChange: (days: number) => void;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = DATE_RANGE_OPTIONS.find(o => o.value === value);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                    "bg-white/10 hover:bg-white/20 transition-colors",
                    "text-sm text-foreground"
                )}
            >
                <Calendar size={14} />
                <span>{selectedOption?.label || "90 Days"}</span>
                <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-1 z-10 min-w-[120px] py-1 rounded-lg bg-zinc-800 border border-white/10 shadow-xl">
                    {DATE_RANGE_OPTIONS.map(option => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={cn(
                                "w-full px-3 py-1.5 text-left text-sm hover:bg-white/10",
                                option.value === value && "text-emerald-400"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function PlayerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const playerSlug = params.player as string;

    const [playerData, setPlayerData] = useState<PlayerData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [daysBack, setDaysBack] = useState(90);

    // Fetch player data
    const fetchData = useCallback(async () => {
        try {
            setError(null);
            const decodedPlayer = decodeURIComponent(playerSlug);
            const response = await fetch(
                `/api/collection/sales?player=${encodeURIComponent(decodedPlayer)}&days=${daysBack}`
            );
            const json = await response.json();

            if (json.success && json.data?.players?.length > 0) {
                setPlayerData(json.data.players[0]);
            } else {
                setError("Player not found or no sales data available");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load data");
        } finally {
            setIsLoading(false);
        }
    }, [playerSlug, daysBack]);

    useEffect(() => {
        setIsLoading(true);
        fetchData();
    }, [fetchData]);

    // Refresh handler - scrapes new data
    const handleRefresh = async () => {
        if (isRefreshing) return;

        setIsRefreshing(true);
        try {
            const decodedPlayer = decodeURIComponent(playerSlug);
            await fetch("/api/collection/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerNames: [decodedPlayer] }),
            });
            await fetchData();
        } catch (err) {
            console.error("Refresh failed:", err);
        } finally {
            setIsRefreshing(false);
        }
    };

    if (isLoading) {
        return (
            <InfiniteGrid>
                <div className="w-full min-h-screen flex items-center justify-center">
                    <Loader2 size={48} className="animate-spin text-primary" />
                </div>
            </InfiniteGrid>
        );
    }

    if (error || !playerData) {
        return (
            <InfiniteGrid>
                <div className="w-full min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-muted-foreground mb-4">{error || "Player not found"}</p>
                        <button
                            onClick={() => router.push("/")}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground mx-auto"
                        >
                            <ArrowLeft size={18} />
                            Back to Collection
                        </button>
                    </div>
                </div>
            </InfiniteGrid>
        );
    }

    return (
        <InfiniteGrid>
            <div className="w-full max-w-6xl mx-auto px-6 py-12">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <button
                        onClick={() => router.push("/")}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
                    >
                        <ArrowLeft size={18} />
                        <span>Back to Collection</span>
                    </button>

                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-4xl font-bold text-foreground capitalize mb-2">
                                {playerData.playerName}
                            </h1>
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <span>1st Bowman Chrome Base Auto</span>
                                {playerData.inferredYear && (
                                    <span className="px-2 py-0.5 rounded bg-white/10 text-xs">
                                        {playerData.inferredYear}
                                    </span>
                                )}
                                <span className="flex items-center gap-1 text-xs">
                                    <Database size={12} />
                                    {playerData.totalSalesInDb} total sales
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <DateRangeSelector value={daysBack} onChange={setDaysBack} />

                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-xl",
                                    "bg-emerald-600 hover:bg-emerald-500 transition-colors",
                                    "text-white font-medium",
                                    isRefreshing && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
                                <span>{isRefreshing ? "Scraping..." : "Refresh"}</span>
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
                >
                    <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                            <Calendar size={14} />
                            <span>Article Price</span>
                        </div>
                        <div className="text-2xl font-bold text-yellow-400">
                            {playerData.baseline ? formatCurrency(playerData.baseline.price) : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {playerData.baseline ? formatFullDate(playerData.baseline.date) : "Not tracked"}
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                            <DollarSign size={14} />
                            <span>Current Avg</span>
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {playerData.marketStats ? formatCurrency(playerData.marketStats.averagePrice) : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {playerData.marketStats
                                ? `Median: ${formatCurrency(playerData.marketStats.medianPrice)}`
                                : "No market data"
                            }
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                            {playerData.priceDelta?.direction === "up" ? (
                                <TrendingUp size={14} className="text-emerald-400" />
                            ) : playerData.priceDelta?.direction === "down" ? (
                                <TrendingDown size={14} className="text-rose-400" />
                            ) : (
                                <span className="w-3.5 h-3.5 rounded-full bg-zinc-400" />
                            )}
                            <span>Change</span>
                        </div>
                        <div
                            className={cn(
                                "text-2xl font-bold",
                                playerData.priceDelta?.direction === "up" && "text-emerald-400",
                                playerData.priceDelta?.direction === "down" && "text-rose-400",
                                playerData.priceDelta?.direction === "stable" && "text-zinc-400"
                            )}
                        >
                            {playerData.priceDelta
                                ? `${playerData.priceDelta.percentageChange > 0 ? "+" : ""}${playerData.priceDelta.percentageChange.toFixed(1)}%`
                                : "—"
                            }
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {playerData.priceDelta
                                ? `${playerData.priceDelta.absoluteChange > 0 ? "+" : ""}${formatCurrency(playerData.priceDelta.absoluteChange)}`
                                : "—"
                            }
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                            <DollarSign size={14} />
                            <span>Last Sale</span>
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {playerData.marketStats
                                ? formatCurrency(playerData.marketStats.lastSalePrice)
                                : "—"
                            }
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {playerData.marketStats
                                ? formatFullDate(playerData.marketStats.lastSaleDate)
                                : "—"
                            }
                        </div>
                    </div>
                </motion.div>

                {/* Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-6 rounded-2xl bg-white/10 border border-white/10 mb-8"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-foreground">
                            Sales Price History
                        </h2>
                        <span className="text-sm text-muted-foreground">
                            Last {daysBack} days
                        </span>
                    </div>
                    <LineChart
                        sales={playerData.sales}
                        baselinePrice={playerData.baseline?.price || null}
                        baselineDate={playerData.baseline?.date || null}
                    />
                </motion.div>

                {/* Sales Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-6 rounded-2xl bg-white/10 border border-white/10"
                >
                    <h2 className="text-lg font-semibold text-foreground mb-4">
                        All Base Auto Sales ({playerData.sales.length})
                    </h2>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {playerData.sales.map((sale) => (
                            <div
                                key={sale.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground truncate" title={sale.title}>
                                        {sale.title}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{formatFullDate(sale.saleDate)}</span>
                                        <span className="opacity-50">•</span>
                                        <span
                                            className={cn(
                                                sale.saleType === "Auction" && "text-blue-400",
                                                sale.saleType === "Best Offer" && "text-purple-400",
                                                sale.saleType === "Buy It Now" && "text-emerald-400"
                                            )}
                                        >
                                            {sale.saleType}
                                        </span>
                                        {sale.releaseYear && (
                                            <>
                                                <span className="opacity-50">•</span>
                                                <span className="text-zinc-500">{sale.releaseYear}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-foreground tabular-nums">
                                        {formatCurrency(sale.salePrice)}
                                    </span>
                                    <a
                                        href={sale.ebayUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    >
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                            </div>
                        ))}

                        {playerData.sales.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                No sales in the last {daysBack} days. Try expanding the date range or refresh to scrape new data.
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </InfiniteGrid>
    );
}
