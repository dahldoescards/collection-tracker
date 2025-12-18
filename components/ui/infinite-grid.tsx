/**
 * =============================================================================
 * INFINITE GRID - Ultra-Lightweight Background
 * =============================================================================
 * 
 * Maximum performance background with minimal GPU impact.
 * Uses only CSS gradients - no blur, no animations, no effects.
 * 
 * @author Collection Tool
 * @version 3.0.0 (Ultra Performance)
 */

import React, { memo } from "react";
import { cn } from "@/lib/utils";

// Static grid pattern using pure CSS - no SVG, no animation
const GridBackground = memo(() => (
    <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
            backgroundImage: `
                linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
        }}
    />
));
GridBackground.displayName = 'GridBackground';

interface InfiniteGridProps {
    children?: React.ReactNode;
}

/**
 * Ultra-lightweight background wrapper.
 * Removes all expensive effects (blur, animations, spotlight).
 * Uses only CSS gradients for ambient lighting.
 */
export const InfiniteGrid = memo(({ children }: InfiniteGridProps) => {
    return (
        <div className={cn(
            "relative w-full min-h-screen flex flex-col items-center overflow-hidden",
            "bg-zinc-950"
        )}>
            {/* Pure CSS grid - very fast */}
            <GridBackground />

            {/* Simple gradient overlays - no blur, no animation */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Top-right warm accent */}
                <div
                    className="absolute right-0 top-0 w-1/2 h-1/2"
                    style={{
                        background: 'radial-gradient(ellipse at 100% 0%, rgba(251, 146, 60, 0.06) 0%, transparent 50%)',
                    }}
                />
                {/* Bottom-left cool accent */}
                <div
                    className="absolute left-0 bottom-0 w-1/2 h-1/2"
                    style={{
                        background: 'radial-gradient(ellipse at 0% 100%, rgba(59, 130, 246, 0.06) 0%, transparent 50%)',
                    }}
                />
            </div>

            {/* Main content */}
            <div className="relative z-10 w-full">
                {children}
            </div>
        </div>
    );
});

InfiniteGrid.displayName = 'InfiniteGrid';

export default InfiniteGrid;
