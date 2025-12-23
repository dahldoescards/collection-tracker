/**
 * =============================================================================
 * AUTH CONFIGURATION - NextAuth.js Setup
 * =============================================================================
 * 
 * Configures authentication using NextAuth.js with credentials provider.
 * Uses SQLite for session storage via custom adapter.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { verifyCredentials, getUserById } from './auth-database';

// Extend the built-in session types
declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            email: string;
            name: string;
        };
    }

    interface User {
        id: string;
        email: string;
        name: string;
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const user = await verifyCredentials(
                    credentials.email as string,
                    credentials.password as string
                );

                if (!user) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id as string;
                token.email = (user.email || '') as string;
                token.name = (user.name || '') as string;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.email = token.email as string;
                session.user.name = token.name as string;
            }
            return session;
        },
    },
    pages: {
        signIn: '/auth/login',
        error: '/auth/error',
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    trustHost: true,
});

/**
 * Get currently authenticated user from session
 */
export async function getCurrentUser() {
    const session = await auth();
    if (!session?.user?.id) {
        return null;
    }
    return getUserById(session.user.id);
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth() {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('Authentication required');
    }
    return user;
}
