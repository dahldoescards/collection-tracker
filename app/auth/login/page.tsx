"use client";

/**
 * =============================================================================
 * LOGIN PAGE
 * =============================================================================
 * 
 * User login page with email/password authentication.
 * Includes link to registration page.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import React, { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, AlertCircle, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

// Login form that uses useSearchParams
function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/";
    const error = searchParams.get("error");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(
        error === "CredentialsSignin" ? "Invalid email or password" : null
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage(null);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setErrorMessage("Invalid email or password");
                setIsLoading(false);
            } else {
                router.push(callbackUrl);
                router.refresh();
            }
        } catch (err) {
            setErrorMessage("An error occurred. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Error Message */}
            {errorMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3"
                >
                    <AlertCircle size={20} className="text-destructive shrink-0" />
                    <p className="text-sm text-destructive">{errorMessage}</p>
                </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Input */}
                <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-foreground/80">
                        Email
                    </label>
                    <div className="relative">
                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className={cn(
                                "w-full pl-12 pr-4 py-3 rounded-xl",
                                "bg-white/5 border border-white/10",
                                "text-foreground placeholder:text-muted-foreground/50",
                                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                                "transition-all duration-200"
                            )}
                        />
                    </div>
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-foreground/80">
                        Password
                    </label>
                    <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className={cn(
                                "w-full pl-12 pr-4 py-3 rounded-xl",
                                "bg-white/5 border border-white/10",
                                "text-foreground placeholder:text-muted-foreground/50",
                                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                                "transition-all duration-200"
                            )}
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className={cn(
                        "w-full py-3 rounded-xl font-semibold",
                        "bg-gradient-to-r from-primary to-primary/80",
                        "text-primary-foreground",
                        "shadow-lg shadow-primary/25",
                        "hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                        "transition-all duration-200"
                    )}
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 size={20} className="animate-spin" />
                            Signing in...
                        </span>
                    ) : (
                        "Sign In"
                    )}
                </button>
            </form>
        </>
    );
}

// Loading fallback for the form
function LoginFormFallback() {
    return (
        <div className="space-y-5 animate-pulse">
            <div className="space-y-2">
                <div className="h-4 w-12 bg-white/10 rounded" />
                <div className="h-12 bg-white/5 rounded-xl" />
            </div>
            <div className="space-y-2">
                <div className="h-4 w-16 bg-white/10 rounded" />
                <div className="h-12 bg-white/5 rounded-xl" />
            </div>
            <div className="h-12 bg-primary/50 rounded-xl" />
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
            {/* Background Pattern */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-radial from-primary/10 to-transparent rounded-full blur-3xl" />
                <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative"
            >
                {/* Logo / Branding */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-3 mb-4"
                    >
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                            <BarChart3 size={28} className="text-primary-foreground" />
                        </div>
                        <h1 className="text-3xl font-bold text-foreground">
                            Collection Tracker
                        </h1>
                    </motion.div>
                    <p className="text-muted-foreground">
                        Sign in to access your collection
                    </p>
                </div>

                {/* Login Card */}
                <div className="p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
                    <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">
                        Welcome Back
                    </h2>

                    <Suspense fallback={<LoginFormFallback />}>
                        <LoginForm />
                    </Suspense>

                    {/* Divider */}
                    <div className="my-6 flex items-center gap-4">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-sm text-muted-foreground">or</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Register Link */}
                    <p className="text-center text-muted-foreground">
                        Don't have an account?{" "}
                        <Link
                            href="/auth/register"
                            className="text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                            Create one
                        </Link>
                    </p>
                </div>

                {/* Back to Home */}
                <p className="text-center mt-6">
                    <Link
                        href="/"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← Back to Collection
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
