"use client";

/**
 * =============================================================================
 * REGISTER PAGE
 * =============================================================================
 * 
 * User registration page with email, password, and name fields.
 * Includes password strength validation.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, User, AlertCircle, CheckCircle2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordRequirement {
    label: string;
    test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
    { label: "At least 8 characters", test: (p) => p.length >= 8 },
    { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
    { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
    { label: "One number", test: (p) => /[0-9]/.test(p) },
];

export default function RegisterPage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showPasswordHints, setShowPasswordHints] = useState(false);

    const passwordsMatch = password === confirmPassword;
    const allRequirementsMet = PASSWORD_REQUIREMENTS.every((req) => req.test(password));
    const isFormValid = name.trim().length >= 2 && email && allRequirementsMet && passwordsMatch;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isFormValid) {
            setErrorMessage("Please fix the errors above");
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            // Register the user
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, name: name.trim() }),
            });

            const result = await response.json();

            if (!response.ok) {
                setErrorMessage(result.error?.message || "Registration failed");
                setIsLoading(false);
                return;
            }

            // Auto-login after registration
            const signInResult = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (signInResult?.error) {
                // Registration succeeded but login failed - redirect to login
                router.push("/auth/login?registered=true");
            } else {
                // Success - redirect to home
                router.push("/");
                router.refresh();
            }

        } catch (err) {
            setErrorMessage("An error occurred. Please try again.");
            setIsLoading(false);
        }
    };

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
                        Create an account to track favorites
                    </p>
                </div>

                {/* Register Card */}
                <div className="p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
                    <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">
                        Create Account
                    </h2>

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
                        {/* Name Input */}
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium text-foreground/80">
                                Name
                            </label>
                            <div className="relative">
                                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
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
                                    onFocus={() => setShowPasswordHints(true)}
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

                            {/* Password Requirements */}
                            {showPasswordHints && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="pt-2 space-y-1"
                                >
                                    {PASSWORD_REQUIREMENTS.map((req, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "flex items-center gap-2 text-xs",
                                                req.test(password) ? "text-green-400" : "text-muted-foreground"
                                            )}
                                        >
                                            {req.test(password) ? (
                                                <CheckCircle2 size={14} />
                                            ) : (
                                                <div className="w-3.5 h-3.5 rounded-full border border-current" />
                                            )}
                                            {req.label}
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Confirm Password Input */}
                        <div className="space-y-2">
                            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground/80">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className={cn(
                                        "w-full pl-12 pr-4 py-3 rounded-xl",
                                        "bg-white/5 border",
                                        confirmPassword && !passwordsMatch
                                            ? "border-destructive/50"
                                            : "border-white/10",
                                        "text-foreground placeholder:text-muted-foreground/50",
                                        "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                                        "transition-all duration-200"
                                    )}
                                />
                            </div>
                            {confirmPassword && !passwordsMatch && (
                                <p className="text-xs text-destructive">Passwords do not match</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !isFormValid}
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
                                    Creating account...
                                </span>
                            ) : (
                                "Create Account"
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="my-6 flex items-center gap-4">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-sm text-muted-foreground">or</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Login Link */}
                    <p className="text-center text-muted-foreground">
                        Already have an account?{" "}
                        <Link
                            href="/auth/login"
                            className="text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                            Sign in
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
