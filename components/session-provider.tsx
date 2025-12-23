"use client";

/**
 * =============================================================================
 * SESSION PROVIDER - NextAuth Session Wrapper
 * =============================================================================
 * 
 * Client component that provides session context to the app.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface SessionProviderProps {
    children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
    return (
        <NextAuthSessionProvider>
            {children}
        </NextAuthSessionProvider>
    );
}
