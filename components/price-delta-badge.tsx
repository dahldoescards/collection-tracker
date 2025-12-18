"use client";

/**
 * =============================================================================
 * PRICE DELTA BADGE COMPONENT
 * =============================================================================
 * 
 * Visual indicator for price changes with color-coded styling and animations.
 * Supports positive, negative, and neutral price movements.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface PriceDeltaBadgeProps {
    /** Absolute price change in USD */
    absoluteChange: number;

    /** Percentage change */
    percentageChange: number;

    /** Direction of change */
    direction: "up" | "down" | "stable";

    /** Magnitude classification */
    magnitude: "significant" | "moderate" | "minimal";

    /** Display size variant */
    size?: "sm" | "md" | "lg";

    /** Whether to show absolute change */
    showAbsolute?: boolean;

    /** Whether to animate on mount */
    animate?: boolean;

    /** Additional classes */
    className?: string;
}

// =============================================================================
// STYLING CONFIGURATION
// =============================================================================

const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-sm gap-1.5",
    lg: "px-4 py-1.5 text-base gap-2",
};

const iconSizes = {
    sm: 12,
    md: 14,
    lg: 18,
};

const getDirectionStyles = (direction: PriceDeltaBadgeProps["direction"], magnitude: PriceDeltaBadgeProps["magnitude"]) => {
    const intensityMap = {
        significant: {
            up: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-emerald-500/20",
            down: "bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-rose-500/20",
            stable: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
        },
        moderate: {
            up: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
            down: "bg-rose-500/15 text-rose-400 border-rose-500/20",
            stable: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
        },
        minimal: {
            up: "bg-emerald-500/10 text-emerald-400/80 border-emerald-500/15",
            down: "bg-rose-500/10 text-rose-400/80 border-rose-500/15",
            stable: "bg-zinc-500/10 text-zinc-400/80 border-zinc-500/15",
        },
    };

    return intensityMap[magnitude][direction];
};

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const badgeVariants = {
    initial: {
        opacity: 0,
        scale: 0.8,
        y: 5,
    },
    animate: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            type: "spring" as const,
            stiffness: 400,
            damping: 20,
        },
    },
    hover: {
        scale: 1.05,
        transition: {
            type: "spring" as const,
            stiffness: 500,
            damping: 15,
        },
    },
};

const pulseAnimation = {
    animate: {
        boxShadow: [
            "0 0 0 0 currentColor",
            "0 0 0 4px transparent",
        ],
        transition: {
            duration: 1.5,
            repeat: Infinity,
            repeatType: "loop" as const,
        },
    },
};

// =============================================================================
// COMPONENT
// =============================================================================

export const PriceDeltaBadge: React.FC<PriceDeltaBadgeProps> = ({
    absoluteChange,
    percentageChange,
    direction,
    magnitude,
    size = "md",
    showAbsolute = true,
    animate = true,
    className,
}) => {
    // Select the appropriate icon
    const Icon = direction === "up"
        ? (magnitude === "significant" ? TrendingUp : ArrowUp)
        : direction === "down"
            ? (magnitude === "significant" ? TrendingDown : ArrowDown)
            : Minus;

    // Format the percentage
    const formattedPercentage = `${direction === "up" ? "+" : ""}${percentageChange.toFixed(1)}%`;

    // Format the absolute change
    const formattedAbsolute = `${direction === "up" ? "+$" : direction === "down" ? "-$" : "$"}${Math.abs(absoluteChange).toFixed(2)}`;

    return (
        <motion.div
            className={cn(
                // Base styles
                "inline-flex items-center rounded-full border font-medium",
                "backdrop-blur-sm transition-colors duration-200",
                // Size-specific styles
                sizeClasses[size],
                // Direction and magnitude styles
                getDirectionStyles(direction, magnitude),
                // Significant changes get shadow
                magnitude === "significant" && "shadow-lg",
                className
            )}
            variants={animate ? badgeVariants : undefined}
            initial={animate ? "initial" : false}
            animate="animate"
            whileHover="hover"
        >
            {/* Pulse effect for significant changes */}
            {magnitude === "significant" && (
                <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={pulseAnimation.animate}
                />
            )}

            {/* Icon */}
            <Icon size={iconSizes[size]} className="shrink-0" />

            {/* Percentage change */}
            <span className="font-semibold tabular-nums">
                {formattedPercentage}
            </span>

            {/* Absolute change (optional) */}
            {showAbsolute && direction !== "stable" && (
                <span className="opacity-70 text-[0.85em]">
                    ({formattedAbsolute})
                </span>
            )}
        </motion.div>
    );
};

// =============================================================================
// COMPACT VARIANT
// =============================================================================

interface CompactDeltaProps {
    percentageChange: number;
    direction: "up" | "down" | "stable";
    className?: string;
}

export const CompactDelta: React.FC<CompactDeltaProps> = ({
    percentageChange,
    direction,
    className,
}) => {
    const colorClass =
        direction === "up" ? "text-emerald-400" :
            direction === "down" ? "text-rose-400" :
                "text-zinc-400";

    const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;

    return (
        <span className={cn("inline-flex items-center gap-0.5 font-mono text-sm", colorClass, className)}>
            <Icon size={12} />
            <span>{Math.abs(percentageChange).toFixed(1)}%</span>
        </span>
    );
};

// =============================================================================
// EXPORTS
// =============================================================================

export default PriceDeltaBadge;
