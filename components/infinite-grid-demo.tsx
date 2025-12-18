"use client";

/**
 * =============================================================================
 * INFINITE GRID DEMO COMPONENT
 * =============================================================================
 * 
 * Demo wrapper showcasing the Infinite Grid component with sample content.
 * Used for testing and documentation purposes.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, LayoutGrid, Zap } from "lucide-react";
import { InfiniteGrid } from "../../components/ui/infinite-grid";

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
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
// COMPONENT
// =============================================================================

export const InfiniteGridDemo: React.FC = () => {
    return (
        <InfiniteGrid>
            <motion.div
                className="w-full max-w-4xl mx-auto px-6 py-20"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Header */}
                <motion.div variants={itemVariants} className="text-center mb-16">
                    <motion.div
                        className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-primary/10 border border-primary/20"
                        whileHover={{ scale: 1.05 }}
                    >
                        <Sparkles size={16} className="text-primary" />
                        <span className="text-sm text-primary font-medium">Infinite Grid Component</span>
                    </motion.div>

                    <h1 className="text-5xl font-bold text-foreground mb-4 tracking-tight">
                        Premium UI Component
                    </h1>

                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        A sophisticated grid background with mouse-tracking glow effects,
                        subtle animations, and beautiful gradient accents.
                    </p>
                </motion.div>

                {/* Features Grid */}
                <motion.div
                    variants={itemVariants}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
                >
                    {/* Feature 1 */}
                    <motion.div
                        className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-sm"
                        whileHover={{ y: -4, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                            <LayoutGrid size={24} className="text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            Animated Grid
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Continuously flowing grid pattern with subtle motion.
                        </p>
                    </motion.div>

                    {/* Feature 2 */}
                    <motion.div
                        className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-sm"
                        whileHover={{ y: -4, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
                            <TrendingUp size={24} className="text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            Mouse Tracking
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Dynamic glow effect follows cursor position.
                        </p>
                    </motion.div>

                    {/* Feature 3 */}
                    <motion.div
                        className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-sm"
                        whileHover={{ y: -4, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20">
                            <Zap size={24} className="text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            Gradient Orbs
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Beautiful blurred gradient accents in corners.
                        </p>
                    </motion.div>
                </motion.div>

                {/* Code Preview */}
                <motion.div variants={itemVariants}>
                    <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        <pre className="text-sm overflow-x-auto">
                            <code className="text-muted-foreground">
                                {`import { InfiniteGrid } from "@/components/ui/infinite-grid";

export default function Page() {
  return (
    <InfiniteGrid>
      <div className="your-content">
        {/* Your content goes here */}
      </div>
    </InfiniteGrid>
  );
}`}
                            </code>
                        </pre>
                    </div>
                </motion.div>
            </motion.div>
        </InfiniteGrid>
    );
};

export default InfiniteGridDemo;
