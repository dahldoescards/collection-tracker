#!/usr/bin/env npx tsx
/**
 * =============================================================================
 * CRON REFRESH SCRIPT - Direct Database Refresh
 * =============================================================================
 * 
 * This script refreshes all players directly without making HTTP calls.
 * Can be run by Railway cron or manually.
 * 
 * Usage:
 *   npm run cron:refresh
 *   npx tsx scripts/cron-refresh.ts
 * 
 * Railway Cron Setup:
 *   1. Go to your Railway project dashboard
 *   2. Click on your service
 *   3. Go to Settings -> Cron
 *   4. Set schedule: 0 12 * * * (12:00 UTC = 7:00 AM EST)
 *   5. Set command: npm run cron:refresh
 * 
 * @author Collection Tool
 * @version 2.0.0
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'collection_data.db');
const API_ENDPOINT = 'https://back.130point.com/cards/';
const RATE_LIMIT_DELAY_MS = 1500;
const MAX_RETRIES = 3;

// =============================================================================
// LOGGING
// =============================================================================

const log = {
    info: (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`),
    success: (msg: string) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
    warn: (msg: string) => console.warn(`[${new Date().toISOString()}] ⚠️ ${msg}`),
    error: (msg: string) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
};

// =============================================================================
// DATABASE
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

function getDb() {
    if (!db) {
        log.info(`Connecting to database: ${DB_PATH}`);
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');

        // Ensure tables exist
        db.exec(`
            CREATE TABLE IF NOT EXISTS individual_sales (
                id TEXT PRIMARY KEY,
                player_name TEXT NOT NULL,
                normalized_player_name TEXT NOT NULL,
                ebay_url TEXT NOT NULL UNIQUE,
                ebay_item_id TEXT NOT NULL,
                title TEXT NOT NULL,
                sale_price REAL NOT NULL,
                sale_date TEXT NOT NULL,
                sale_type TEXT NOT NULL,
                release_year INTEGER,
                card_type TEXT DEFAULT 'base',
                fetched_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sales_player ON individual_sales(normalized_player_name);
        `);
    }
    return db;
}

// =============================================================================
// GET PLAYERS TO REFRESH
// =============================================================================

interface PlayerInfo {
    normalizedName: string;
    playerName: string;
    releaseYear: number | null;
}

function getPlayersToRefresh(): PlayerInfo[] {
    const database = getDb();

    const rows = database.prepare(`
        SELECT 
            normalized_player_name as normalizedName,
            player_name as playerName,
            release_year as releaseYear
        FROM baseline_prices
        ORDER BY normalized_player_name
    `).all() as PlayerInfo[];

    return rows;
}

// =============================================================================
// SCRAPE PLAYER
// =============================================================================

interface ParsedSale {
    title: string;
    ebayUrl: string;
    ebayItemId: string;
    salePrice: number;
    saleDate: Date;
    saleType: string;
    releaseYear: number | null;
}

// Parallel/color indicators to EXCLUDE for base autos
const PARALLEL_COLORS = [
    'refractor', 'shimmer', 'speckle', 'mojo', 'lava', 'wave',
    'sapphire', 'aqua', 'sky blue',
    'purple', 'blue', 'green', 'gold', 'orange', 'red', 'yellow', 'pink', 'black',
    'atomic', 'prism', 'hyper', 'x-fractor',
];

const GRADED_INDICATORS = ['psa', 'bgs', 'sgc', 'cgc', 'hga', 'csg', 'gem mint', 'mint 9', 'pristine'];
const LOT_INDICATORS = ['lot', 'bundle', 'set of', '(2)', '(3)', '(4)', '(5)', '& ', ' and ', ' + '];
const EXCLUDED_PRODUCTS = ['topps chrome', 'panini', 'donruss', 'prizm', 'leaf', 'finest', 'mega', 'bowman u'];
const IP_INDICATORS = [' ip ', 'in person', 'in-person', 'hand signed', 'convention'];
const SERIAL_PATTERN = /\/\d{1,4}\b/;
const YEAR_PATTERN = /\b(20[1-2][0-9])\b/g;

function normalizeEbayUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        return `${urlObj.origin}${urlObj.pathname}`;
    } catch {
        return url.split('?')[0];
    }
}

function extractYear(title: string): number | null {
    const matches = title.match(YEAR_PATTERN);
    return matches ? parseInt(matches[0], 10) : null;
}

function isBaseAuto(title: string): boolean {
    const lower = title.toLowerCase();

    // Check exclusions
    for (const pattern of [...GRADED_INDICATORS, ...LOT_INDICATORS, ...EXCLUDED_PRODUCTS, ...IP_INDICATORS]) {
        if (lower.includes(pattern)) return false;
    }

    // Check parallels
    for (const color of PARALLEL_COLORS) {
        if (lower.includes(color)) return false;
    }

    // Check serial numbers
    if (SERIAL_PATTERN.test(title)) return false;

    return true;
}

function titleContainsPlayer(title: string, playerName: string): boolean {
    const lowerTitle = title.toLowerCase();
    const nameParts = playerName.toLowerCase().split(/[\s-]+/).filter(p => p.length > 2);
    return nameParts.every(part => lowerTitle.includes(part));
}

async function fetchSalesFromApi(playerName: string, targetYear?: number): Promise<ParsedSale[]> {
    const searchQuery = targetYear
        ? `${playerName} ${targetYear} bowman chrome auto`
        : `${playerName} bowman chrome auto`;

    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `query=${encodeURIComponent(searchQuery)}`,
    });

    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }

    const html = await response.text();
    const sales: ParsedSale[] = [];

    // Parse HTML response
    const rowPattern = /<tr[^>]*id="dRow"[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;

    while ((match = rowPattern.exec(html)) !== null) {
        const fullRow = match[0];
        const rowContent = match[1];

        const priceMatch = fullRow.match(/data-price="([^"]+)"/);
        const checkMatch = fullRow.match(/data-check="([^"]+)"/);
        const currencyMatch = fullRow.match(/data-currency="([^"]+)"/);

        if (!priceMatch || !checkMatch || currencyMatch?.[1] !== 'USD') continue;

        const titleMatch = rowContent.match(/<a[^>]*href='(https:\/\/www\.ebay\.com\/itm\/[^']+)'[^>]*>([^<]+)<\/a>/);
        if (!titleMatch) continue;

        const dateMatch = rowContent.match(/Date:<\/b>\s*([^<]+)</);
        let saleDate = new Date();
        if (dateMatch) {
            const parsed = new Date(dateMatch[1].trim());
            if (!isNaN(parsed.getTime())) saleDate = parsed;
        }

        let saleType = 'Unknown';
        if (rowContent.includes('Fixed Price Sale')) saleType = 'Buy It Now';
        else if (rowContent.includes('Auction')) saleType = 'Auction';
        else if (rowContent.includes('Best Offer')) saleType = 'Best Offer';

        sales.push({
            title: titleMatch[2].trim(),
            ebayUrl: normalizeEbayUrl(titleMatch[1]),
            ebayItemId: checkMatch[1],
            salePrice: parseFloat(priceMatch[1]),
            saleDate,
            saleType,
            releaseYear: extractYear(titleMatch[2]),
        });
    }

    // Deduplicate
    const seen = new Set<string>();
    return sales.filter(s => {
        if (seen.has(s.ebayItemId)) return false;
        seen.add(s.ebayItemId);
        return true;
    });
}

async function scrapePlayer(playerName: string, targetYear?: number): Promise<{
    success: boolean;
    salesInserted: number;
    averagePrice: number | null;
    error?: string;
}> {
    const database = getDb();
    const normalizedName = playerName.toLowerCase().trim();

    try {
        const rawSales = await fetchSalesFromApi(playerName, targetYear);
        if (rawSales.length === 0) {
            return { success: false, salesInserted: 0, averagePrice: null, error: 'No results from API' };
        }

        // Filter to base autos for this player
        const baseAutos = rawSales.filter(s =>
            titleContainsPlayer(s.title, playerName) &&
            isBaseAuto(s.title) &&
            (!targetYear || s.releaseYear === targetYear)
        );

        if (baseAutos.length === 0) {
            return { success: false, salesInserted: 0, averagePrice: null, error: 'No valid base autos found' };
        }

        // Insert new sales
        const insertStmt = database.prepare(`
            INSERT OR IGNORE INTO individual_sales 
            (id, player_name, normalized_player_name, ebay_url, ebay_item_id, title, sale_price, sale_date, sale_type, release_year, card_type, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'base', ?)
        `);

        let inserted = 0;
        for (const sale of baseAutos) {
            const result = insertStmt.run(
                uuidv4(),
                playerName,
                normalizedName,
                sale.ebayUrl,
                sale.ebayItemId,
                sale.title,
                sale.salePrice,
                sale.saleDate.toISOString(),
                sale.saleType,
                sale.releaseYear,
                new Date().toISOString()
            );
            if (result.changes > 0) inserted++;
        }

        // Calculate average from 5 most recent
        const recentSales = database.prepare(`
            SELECT sale_price FROM individual_sales 
            WHERE normalized_player_name = ?
            ORDER BY sale_date DESC LIMIT 5
        `).all(normalizedName) as { sale_price: number }[];

        let averagePrice: number | null = null;
        if (recentSales.length > 0) {
            averagePrice = Math.round((recentSales.reduce((a, b) => a + b.sale_price, 0) / recentSales.length) * 100) / 100;

            // Update current_market table
            database.prepare(`
                INSERT INTO current_market (id, player_name, normalized_player_name, average_price, median_price, last_sale_price, last_sale_date, sample_size, verified_sales_json, fetched_at, card_type, inferred_year)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, 'base', ?)
                ON CONFLICT(normalized_player_name) DO UPDATE SET
                    average_price = excluded.average_price,
                    median_price = excluded.median_price,
                    last_sale_price = excluded.last_sale_price,
                    last_sale_date = excluded.last_sale_date,
                    sample_size = excluded.sample_size,
                    fetched_at = excluded.fetched_at,
                    inferred_year = excluded.inferred_year
            `).run(
                `market_${normalizedName}_${Date.now()}`,
                playerName,
                normalizedName,
                averagePrice,
                averagePrice,
                recentSales[0].sale_price,
                new Date().toISOString(),
                recentSales.length,
                new Date().toISOString(),
                targetYear || null
            );
        }

        return { success: true, salesInserted: inserted, averagePrice };

    } catch (error) {
        return {
            success: false,
            salesInserted: 0,
            averagePrice: null,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    const startTime = Date.now();

    log.info('═'.repeat(60));
    log.info('🔄 DAILY CRON REFRESH STARTING');
    log.info('═'.repeat(60));

    try {
        const players = getPlayersToRefresh();
        log.info(`Found ${players.length} players to refresh`);

        let refreshed = 0;
        let failed = 0;
        let totalNewSales = 0;

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            log.info(`[${i + 1}/${players.length}] ${player.playerName}${player.releaseYear ? ` [${player.releaseYear}]` : ''}`);

            const result = await scrapePlayer(player.playerName, player.releaseYear || undefined);

            if (result.success) {
                refreshed++;
                totalNewSales += result.salesInserted;
                log.success(`  → $${result.averagePrice} avg, ${result.salesInserted} new sales`);
            } else {
                failed++;
                log.warn(`  → ${result.error}`);
            }

            // Rate limiting
            if (i < players.length - 1) {
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
            }
        }

        // Record price snapshots
        const database = getDb();
        const today = new Date().toISOString().split('T')[0];
        const snapshotResult = database.prepare(`
            INSERT OR REPLACE INTO price_history 
            (id, normalized_player_name, average_price, median_price, last_sale_price, sample_size, snapshot_date, created_at)
            SELECT 
                normalized_player_name || '-' || ? as id,
                normalized_player_name,
                average_price,
                median_price,
                last_sale_price,
                sample_size,
                ? as snapshot_date,
                ? as created_at
            FROM current_market
        `).run(today, today, new Date().toISOString());

        const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);

        log.info('═'.repeat(60));
        log.success('CRON REFRESH COMPLETE');
        log.info(`  Total players: ${players.length}`);
        log.info(`  Refreshed: ${refreshed}`);
        log.info(`  Failed: ${failed}`);
        log.info(`  New sales: ${totalNewSales}`);
        log.info(`  Snapshots: ${snapshotResult.changes}`);
        log.info(`  Time: ${executionTime}s`);
        log.info('═'.repeat(60));

        process.exit(0);

    } catch (error) {
        log.error(`Cron failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}

// Run
main();
