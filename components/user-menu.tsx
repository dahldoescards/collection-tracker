"use client";

/**
 * =============================================================================
 * USER MENU COMPONENT
 * =============================================================================
 * 
 * Dropdown menu showing user info and logout option when authenticated,
 * or login/register buttons when not authenticated.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Heart, ChevronDown, LogIn, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserMenuProps {
    className?: string;
    favoriteCount?: number;
}

export function UserMenu({ className, favoriteCount = 0 }: UserMenuProps) {
    const { data: session, status } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Loading state
    if (status === "loading") {
        return (
            <div className={cn("h-10 w-24 rounded-xl bg-white/5 animate-pulse", className)} />
        );
    }

    // Not authenticated - show login/register buttons
    if (!session) {
        return (
            <div className={cn("flex items-center gap-2", className)}>
                <Link
                    href="/auth/login"
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl",
                        "text-sm font-medium text-foreground/80",
                        "hover:bg-white/10 transition-colors"
                    )}
                >
                    <LogIn size={16} />
                    <span className="hidden sm:inline">Sign In</span>
                </Link>
                <Link
                    href="/auth/register"
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl",
                        "text-sm font-medium",
                        "bg-primary text-primary-foreground",
                        "hover:bg-primary/90 transition-colors"
                    )}
                >
                    <UserPlus size={16} />
                    <span className="hidden sm:inline">Register</span>
                </Link>
            </div>
        );
    }

    // Authenticated - show user menu
    const initials = session.user?.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "U";

    return (
        <div ref={menuRef} className={cn("relative", className)}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl",
                    "bg-white/5 border border-white/10",
                    "hover:bg-white/10 hover:border-white/20",
                    "transition-all duration-200",
                    isOpen && "bg-white/10 border-white/20"
                )}
            >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary-foreground">
                        {initials}
                    </span>
                </div>

                {/* Name & Favorites */}
                <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium text-foreground leading-tight">
                        {session.user?.name}
                    </span>
                    {favoriteCount > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Heart size={10} className="fill-current" />
                            {favoriteCount} favorites
                        </span>
                    )}
                </div>

                <ChevronDown
                    size={16}
                    className={cn(
                        "text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                    )}
                />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                            "absolute right-0 top-full mt-2 w-56",
                            "rounded-xl overflow-hidden",
                            "bg-gradient-to-br from-neutral-900 to-neutral-950",
                            "border border-white/10 shadow-xl shadow-black/40",
                            "z-50"
                        )}
                    >
                        {/* User Info */}
                        <div className="p-4 border-b border-white/10">
                            <p className="font-medium text-foreground">{session.user?.name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                                {session.user?.email}
                            </p>
                        </div>

                        {/* Menu Items */}
                        <div className="p-2">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    // Could navigate to favorites filter
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                                    "text-sm text-foreground/80",
                                    "hover:bg-white/10 transition-colors"
                                )}
                            >
                                <Heart size={16} />
                                <span>My Favorites</span>
                                {favoriteCount > 0 && (
                                    <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                        {favoriteCount}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    signOut({ callbackUrl: "/" });
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                                    "text-sm text-foreground/80",
                                    "hover:bg-white/10 transition-colors"
                                )}
                            >
                                <LogOut size={16} />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
