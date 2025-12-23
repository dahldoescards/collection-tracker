/**
 * =============================================================================
 * REGISTER API - User Registration Endpoint
 * =============================================================================
 * 
 * Handles new user registration with validation.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/auth-database';
import {
    rateLimiter,
    RATE_LIMIT_CONFIGS,
    getClientId,
    rateLimitHeaders
} from '@/lib/rate-limiter';

// =============================================================================
// TYPES
// =============================================================================

interface RegisterRequest {
    email: string;
    password: string;
    name: string;
}

interface RegisterResponse {
    success: boolean;
    user?: {
        id: string;
        email: string;
        name: string;
    };
    error?: {
        code: string;
        message: string;
    };
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true };
}

function validateName(name: string): boolean {
    return name.trim().length >= 2;
}

// =============================================================================
// POST HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
    console.log('[Register API] POST /api/auth/register');

    // Rate limiting - strict limit for registration
    const clientId = getClientId(request);
    const rateLimit = rateLimiter.check(`register:${clientId}`, RATE_LIMIT_CONFIGS.auth);

    if (!rateLimit.allowed) {
        console.log(`[Register API] Rate limited: ${clientId}`);
        const headers = rateLimitHeaders(rateLimit, RATE_LIMIT_CONFIGS.auth);
        headers.set('Retry-After', Math.ceil(rateLimit.resetIn / 1000).toString());

        return NextResponse.json<RegisterResponse>({
            success: false,
            error: {
                code: 'RATE_LIMITED',
                message: `Too many registration attempts. Please try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`,
            },
        }, { status: 429, headers });
    }

    try {
        const body = await request.json() as RegisterRequest;
        const { email, password, name } = body;

        // Validate email
        if (!email || !validateEmail(email)) {
            return NextResponse.json<RegisterResponse>({
                success: false,
                error: {
                    code: 'INVALID_EMAIL',
                    message: 'Please provide a valid email address',
                },
            }, { status: 400 });
        }

        // Validate password
        const passwordValidation = validatePassword(password || '');
        if (!passwordValidation.valid) {
            return NextResponse.json<RegisterResponse>({
                success: false,
                error: {
                    code: 'WEAK_PASSWORD',
                    message: passwordValidation.message || 'Password does not meet requirements',
                },
            }, { status: 400 });
        }

        // Validate name
        if (!name || !validateName(name)) {
            return NextResponse.json<RegisterResponse>({
                success: false,
                error: {
                    code: 'INVALID_NAME',
                    message: 'Name must be at least 2 characters',
                },
            }, { status: 400 });
        }

        // Check if user already exists
        const existingUser = getUserByEmail(email);
        if (existingUser) {
            return NextResponse.json<RegisterResponse>({
                success: false,
                error: {
                    code: 'USER_EXISTS',
                    message: 'An account with this email already exists',
                },
            }, { status: 409 });
        }

        // Create user
        const user = await createUser(email, password, name.trim());

        console.log(`[Register API] Created user: ${user.email}`);

        return NextResponse.json<RegisterResponse>({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        }, { status: 201 });

    } catch (error) {
        console.error('[Register API] Error:', error);

        return NextResponse.json<RegisterResponse>({
            success: false,
            error: {
                code: 'REGISTRATION_FAILED',
                message: error instanceof Error ? error.message : 'Registration failed',
            },
        }, { status: 500 });
    }
}
