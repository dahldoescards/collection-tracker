"use client";

/**
 * =============================================================================
 * FAVORITE BUTTON COMPONENT
 * =============================================================================
 * 
 * Toggle button for adding/removing a player from favorites.
 * Shows login prompt when not authenticated.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import React, { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
    playerName: string;
    initialIsFavorite?: boolean;
    onToggle?: (isFavorite: boolean) => void;
    size?: "sm" | "md" | "lg";
    showLabel?: boolean;
    className?: string;
}

export function FavoriteButton({
    playerName,
    initialIsFavorite = false,
    onToggle,
    size = "md",
    showLabel = false,
    className,
}: FavoriteButtonProps) {
    const { data: session, status } = useSession();
    const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
    const [isLoading, setIsLoading] = useState(false);
    const [showLoginHint, setShowLoginHint] = useState(false);

    const iconSize = size === "sm" ? 14 : size === "lg" ? 24 : 18;

    const handleClick = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // If not authenticated, show login hint
        if (!session) {
            setShowLoginHint(true);
            setTimeout(() => setShowLoginHint(false), 3000);
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch("/api/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerName, toggle: true }),
            });

            const result = await response.json();

            if (result.success) {
                const newState = result.isFavorite;
                setIsFavorite(newState);
                onToggle?.(newState);
            }
        } catch (error) {
            console.error("Failed to toggle favorite:", error);
        } finally {
            setIsLoading(false);
        }
    }, [session, playerName, onToggle]);

    return (
        <div className="relative">
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleClick}
                disabled={isLoading}
                className={cn(
                    "relative flex items-center gap-2 rounded-lg transition-colors",
                    size === "sm" && "p-1.5",
                    size === "md" && "p-2",
                    size === "lg" && "p-3",
                    isFavorite
                        ? "text-red-500 hover:text-red-400"
                        : "text-muted-foreground hover:text-red-400",
                    "hover:bg-white/10",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    className
                )}
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
                {isLoading ? (
                    <Loader2 size={iconSize} className="animate-spin" />
                ) : (
                    <Heart
                        size={iconSize}
                        className={cn(
                            "transition-all duration-200",
                            isFavorite && "fill-current"
                        )}
                    />
                )}
                {showLabel && (
                    <span className="text-sm">
                        {isFavorite ? "Favorited" : "Favorite"}
                    </span>
                )}
            </motion.button>

            {/* Login Hint Tooltip */}
            <AnimatePresence>
                {showLoginHint && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        className={cn(
                            "absolute bottom-full left-1/2 -translate-x-1/2 mb-2",
                            "px-3 py-2 rounded-lg",
                            "bg-neutral-900 border border-white/10",
                            "text-xs text-foreground whitespace-nowrap",
                            "shadow-lg z-50"
                        )}
                    >
                        <a href="/auth/login" className="text-primary hover:underline">
                            Sign in
                        </a>
                        {" to save favorites"}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                            <div className="border-4 border-transparent border-t-neutral-900" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
