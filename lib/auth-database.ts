/**
 * =============================================================================
 * AUTH DATABASE - User & Favorites Storage
 * =============================================================================
 * 
 * SQLite-based user authentication and favorites storage.
 * Integrates with the existing collection_data.db database.
 * 
 * Tables:
 * - users: User accounts with hashed passwords
 * - user_sessions: Active login sessions
 * - user_favorites: Player favorites per user
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'collection_data.db');
const SALT_ROUNDS = 12;
const SESSION_EXPIRY_DAYS = 30;

// =============================================================================
// TYPES
// =============================================================================

export interface User {
    id: string;
    email: string;
    name: string;
    passwordHash?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserSession {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}

export interface UserFavorite {
    id: string;
    userId: string;
    normalizedPlayerName: string;
    createdAt: Date;
}

interface UserRow {
    id: string;
    email: string;
    name: string;
    password_hash: string;
    created_at: string;
    updated_at: string;
}

interface SessionRow {
    id: string;
    user_id: string;
    token: string;
    expires_at: string;
    created_at: string;
}

interface FavoriteRow {
    id: string;
    user_id: string;
    normalized_player_name: string;
    created_at: string;
}

// =============================================================================
// DATABASE INITIALIZATION
// =============================================================================

let db: Database.Database | null = null;

function getDb(): Database.Database {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');

        // Create auth tables
        db.exec(`
            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            
            -- Sessions table
            CREATE TABLE IF NOT EXISTS user_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
            
            -- Favorites table
            CREATE TABLE IF NOT EXISTS user_favorites (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                normalized_player_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(user_id, normalized_player_name),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
            CREATE INDEX IF NOT EXISTS idx_favorites_player ON user_favorites(normalized_player_name);
        `);
    }
    return db;
}

// =============================================================================
// USER OPERATIONS
// =============================================================================

/**
 * Create a new user account
 */
export async function createUser(
    email: string,
    password: string,
    name: string
): Promise<User> {
    const database = getDb();

    // Check if user already exists
    const existing = database.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
        throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const now = new Date().toISOString();
    const user: User = {
        id: uuidv4(),
        email: email.toLowerCase(),
        name,
        createdAt: new Date(now),
        updatedAt: new Date(now),
    };

    database.prepare(`
        INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.id, user.email, user.name, passwordHash, now, now);

    console.log(`[Auth DB] Created user: ${user.email}`);
    return user;
}

/**
 * Verify user credentials and return user if valid
 */
export async function verifyCredentials(
    email: string,
    password: string
): Promise<User | null> {
    const database = getDb();

    const row = database.prepare<[string], UserRow>(`
        SELECT * FROM users WHERE email = ?
    `).get(email.toLowerCase());

    if (!row) {
        return null;
    }

    const isValid = await bcrypt.compare(password, row.password_hash);
    if (!isValid) {
        return null;
    }

    return {
        id: row.id,
        email: row.email,
        name: row.name,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

/**
 * Get user by ID
 */
export function getUserById(userId: string): User | null {
    const database = getDb();

    const row = database.prepare<[string], UserRow>(`
        SELECT * FROM users WHERE id = ?
    `).get(userId);

    if (!row) return null;

    return {
        id: row.id,
        email: row.email,
        name: row.name,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | null {
    const database = getDb();

    const row = database.prepare<[string], UserRow>(`
        SELECT * FROM users WHERE email = ?
    `).get(email.toLowerCase());

    if (!row) return null;

    return {
        id: row.id,
        email: row.email,
        name: row.name,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

/**
 * Update user password
 */
export async function updateUserPassword(
    userId: string,
    newPassword: string
): Promise<void> {
    const database = getDb();
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    database.prepare(`
        UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
    `).run(passwordHash, new Date().toISOString(), userId);
}

// =============================================================================
// SESSION OPERATIONS
// =============================================================================

/**
 * Create a new session for a user
 */
export function createSession(userId: string): UserSession {
    const database = getDb();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const session: UserSession = {
        id: uuidv4(),
        userId,
        token: uuidv4() + uuidv4(), // Extra long token
        expiresAt,
        createdAt: now,
    };

    database.prepare(`
        INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(session.id, session.userId, session.token, expiresAt.toISOString(), now.toISOString());

    return session;
}

/**
 * Get session by token
 */
export function getSessionByToken(token: string): UserSession | null {
    const database = getDb();

    const row = database.prepare<[string], SessionRow>(`
        SELECT * FROM user_sessions WHERE token = ? AND expires_at > datetime('now')
    `).get(token);

    if (!row) return null;

    return {
        id: row.id,
        userId: row.user_id,
        token: row.token,
        expiresAt: new Date(row.expires_at),
        createdAt: new Date(row.created_at),
    };
}

/**
 * Delete a session (logout)
 */
export function deleteSession(token: string): void {
    const database = getDb();
    database.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
}

/**
 * Delete all sessions for a user
 */
export function deleteAllUserSessions(userId: string): void {
    const database = getDb();
    database.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): number {
    const database = getDb();
    const result = database.prepare(`
        DELETE FROM user_sessions WHERE expires_at < datetime('now')
    `).run();
    return result.changes;
}

// =============================================================================
// FAVORITES OPERATIONS
// =============================================================================

/**
 * Add a player to user's favorites
 */
export function addFavorite(userId: string, normalizedPlayerName: string): UserFavorite {
    const database = getDb();

    const existing = database.prepare<[string, string], FavoriteRow>(`
        SELECT * FROM user_favorites WHERE user_id = ? AND normalized_player_name = ?
    `).get(userId, normalizedPlayerName.toLowerCase());

    if (existing) {
        return {
            id: existing.id,
            userId: existing.user_id,
            normalizedPlayerName: existing.normalized_player_name,
            createdAt: new Date(existing.created_at),
        };
    }

    const now = new Date().toISOString();
    const favorite: UserFavorite = {
        id: uuidv4(),
        userId,
        normalizedPlayerName: normalizedPlayerName.toLowerCase(),
        createdAt: new Date(now),
    };

    database.prepare(`
        INSERT INTO user_favorites (id, user_id, normalized_player_name, created_at)
        VALUES (?, ?, ?, ?)
    `).run(favorite.id, favorite.userId, favorite.normalizedPlayerName, now);

    console.log(`[Auth DB] Added favorite: ${normalizedPlayerName} for user ${userId}`);
    return favorite;
}

/**
 * Remove a player from user's favorites
 */
export function removeFavorite(userId: string, normalizedPlayerName: string): boolean {
    const database = getDb();

    const result = database.prepare(`
        DELETE FROM user_favorites WHERE user_id = ? AND normalized_player_name = ?
    `).run(userId, normalizedPlayerName.toLowerCase());

    return result.changes > 0;
}

/**
 * Get all favorites for a user
 */
export function getUserFavorites(userId: string): string[] {
    const database = getDb();

    const rows = database.prepare<[string], FavoriteRow>(`
        SELECT * FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);

    return rows.map(row => row.normalized_player_name);
}

/**
 * Check if a player is in user's favorites
 */
export function isFavorite(userId: string, normalizedPlayerName: string): boolean {
    const database = getDb();

    const row = database.prepare(`
        SELECT 1 FROM user_favorites WHERE user_id = ? AND normalized_player_name = ?
    `).get(userId, normalizedPlayerName.toLowerCase());

    return !!row;
}

/**
 * Get favorite count for a user
 */
export function getFavoriteCount(userId: string): number {
    const database = getDb();

    const row = database.prepare<[string], { count: number }>(`
        SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?
    `).get(userId);

    return row?.count || 0;
}

/**
 * Toggle favorite status
 */
export function toggleFavorite(userId: string, normalizedPlayerName: string): boolean {
    if (isFavorite(userId, normalizedPlayerName)) {
        removeFavorite(userId, normalizedPlayerName);
        return false;
    } else {
        addFavorite(userId, normalizedPlayerName);
        return true;
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { getDb as getAuthDb };
