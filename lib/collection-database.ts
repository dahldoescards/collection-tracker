/**
 * =============================================================================
 * COLLECTION DATABASE - SQLite Storage Layer
 * =============================================================================
 * 
 * Persistent storage for baseline prices, market data, and tracked cards.
 * Uses better-sqlite3 for synchronous, high-performance SQLite access.
 * 
 * Database Schema:
 * - baseline_prices: Historical prices from BigBobCards articles
 * - current_market: Real-time market data from 130point
 * - tracked_cards: Combined tracking with delta calculations
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import * as path from 'path';

import {
    BaselinePrice,
    CurrentMarketData,
    TrackedCard,
    PriceDelta,
    BaselinePriceRow,
    CurrentMarketRow,
    TrackedCardRow,
    DashboardStats,
    CollectionConfig,
    DEFAULT_COLLECTION_CONFIG,
    CompSale,
} from './collection-types';
import { PLAYER_RANKINGS } from './types';

// =============================================================================
// DATABASE CONFIGURATION
// =============================================================================

/**
 * Database file path - stored in the collection folder
 * Uses process.cwd() for Next.js server compatibility
 */
const DB_PATH = path.join(process.cwd(), 'collection_data.db');

/**
 * Singleton database instance
 */
let db: Database.Database | null = null;

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

const log = {
    info: (msg: string, ...args: unknown[]) => console.log(`[Collection DB] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[Collection DB] ⚠️ ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[Collection DB] ❌ ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Collection DB] 🐛 ${msg}`, ...args);
        }
    },
};

// =============================================================================
// DATABASE INITIALIZATION
// =============================================================================

/**
 * Initialize the database with required tables
 * Creates tables if they don't exist, applies migrations
 */
export function initializeDatabase(): Database.Database {
    if (db) return db;

    log.info(`Initializing database at: ${DB_PATH}`);

    db = new Database(DB_PATH);

    // Performance optimizations
    db.pragma('journal_mode = WAL');        // Write-ahead logging for concurrent reads
    db.pragma('synchronous = NORMAL');      // Balance between safety and speed
    db.pragma('cache_size = 10000');        // ~40MB cache (10000 pages * 4KB)
    db.pragma('temp_store = MEMORY');       // Store temp tables in memory
    db.pragma('mmap_size = 268435456');     // 256MB memory-mapped I/O

    // Create tables
    db.exec(`
    -- Baseline prices from BigBobCards articles
    CREATE TABLE IF NOT EXISTS baseline_prices (
      id TEXT PRIMARY KEY,
      player_name TEXT NOT NULL,
      normalized_player_name TEXT NOT NULL,
      original_price REAL NOT NULL,
      article_date TEXT NOT NULL,
      article_source TEXT NOT NULL,
      release_year INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL,
      
      -- Index for player lookups
      UNIQUE(normalized_player_name, article_source)
    );
    
    CREATE INDEX IF NOT EXISTS idx_baseline_player 
      ON baseline_prices(normalized_player_name);
    
    CREATE INDEX IF NOT EXISTS idx_baseline_date 
      ON baseline_prices(article_date);
    
    -- Current market data from 130point
    CREATE TABLE IF NOT EXISTS current_market (
      id TEXT PRIMARY KEY,
      player_name TEXT NOT NULL,
      normalized_player_name TEXT NOT NULL UNIQUE,
      average_price REAL NOT NULL,
      median_price REAL NOT NULL,
      last_sale_price REAL NOT NULL,
      last_sale_date TEXT NOT NULL,
      sample_size INTEGER NOT NULL,
      verified_sales_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      card_type TEXT NOT NULL DEFAULT 'base'
    );
    
    CREATE INDEX IF NOT EXISTS idx_market_player 
      ON current_market(normalized_player_name);
    
    CREATE INDEX IF NOT EXISTS idx_market_fetched 
      ON current_market(fetched_at);
    
    -- Tracked cards combining baseline and market data
    CREATE TABLE IF NOT EXISTS tracked_cards (
      id TEXT PRIMARY KEY,
      player_name TEXT NOT NULL,
      normalized_player_name TEXT NOT NULL UNIQUE,
      hobby_ranking INTEGER,
      release_year INTEGER NOT NULL,
      baseline_id TEXT NOT NULL,
      current_market_id TEXT,
      last_updated TEXT NOT NULL,
      
      FOREIGN KEY (baseline_id) REFERENCES baseline_prices(id),
      FOREIGN KEY (current_market_id) REFERENCES current_market(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_tracked_ranking 
      ON tracked_cards(hobby_ranking);
    
    -- Price history for tracking price changes over time
    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT PRIMARY KEY,
      normalized_player_name TEXT NOT NULL,
      average_price REAL NOT NULL,
      median_price REAL,
      last_sale_price REAL,
      sample_size INTEGER,
      snapshot_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      
      -- One snapshot per player per day
      UNIQUE(normalized_player_name, snapshot_date)
    );
    
    CREATE INDEX IF NOT EXISTS idx_history_player 
      ON price_history(normalized_player_name);
    
    CREATE INDEX IF NOT EXISTS idx_history_date 
      ON price_history(snapshot_date);
    
    CREATE INDEX IF NOT EXISTS idx_history_player_date 
      ON price_history(normalized_player_name, snapshot_date);
  `);

    // Migration: Add card_type column if it doesn't exist
    try {
        db.exec(`ALTER TABLE current_market ADD COLUMN card_type TEXT NOT NULL DEFAULT 'base'`);
        log.info('Migration: Added card_type column to current_market table');
    } catch {
        // Column already exists, ignore error
    }

    // Migration: Add inferred_year column if it doesn't exist
    try {
        db.exec(`ALTER TABLE current_market ADD COLUMN inferred_year INTEGER`);
        log.info('Migration: Added inferred_year column to current_market table');
    } catch {
        // Column already exists, ignore error
    }

    log.info('Database initialized successfully');

    return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
        log.info('Database connection closed');
    }
}

/**
 * Get the database instance (initializes if needed)
 */
function getDb(): Database.Database {
    if (!db) {
        return initializeDatabase();
    }
    return db;
}

// =============================================================================
// BASELINE PRICE OPERATIONS
// =============================================================================

/**
 * Insert or update a baseline price record
 */
export function upsertBaselinePrice(price: BaselinePrice): void {
    const db = getDb();

    const stmt = db.prepare(`
    INSERT INTO baseline_prices (
      id, player_name, normalized_player_name, original_price,
      article_date, article_source, release_year, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(normalized_player_name, article_source) DO UPDATE SET
      original_price = excluded.original_price,
      article_date = excluded.article_date,
      notes = excluded.notes
  `);

    stmt.run(
        price.id,
        price.playerName,
        price.normalizedPlayerName,
        price.originalPrice,
        price.articleDate.toISOString(),
        price.articleSource,
        price.releaseYear || null,
        price.notes || null,
        price.createdAt.toISOString()
    );

    log.debug(`Upserted baseline: ${price.playerName} @ $${price.originalPrice}`);
}

/**
 * Insert multiple baseline prices in a transaction
 */
export function bulkInsertBaselinePrices(prices: BaselinePrice[]): number {
    const db = getDb();

    const insert = db.prepare(`
    INSERT INTO baseline_prices (
      id, player_name, normalized_player_name, original_price,
      article_date, article_source, release_year, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(normalized_player_name, article_source) DO UPDATE SET
      original_price = excluded.original_price,
      article_date = excluded.article_date,
      notes = excluded.notes
  `);

    const insertMany = db.transaction((prices: BaselinePrice[]) => {
        let count = 0;
        for (const price of prices) {
            insert.run(
                price.id,
                price.playerName,
                price.normalizedPlayerName,
                price.originalPrice,
                price.articleDate.toISOString(),
                price.articleSource,
                price.releaseYear || null,
                price.notes || null,
                price.createdAt.toISOString()
            );
            count++;
        }
        return count;
    });

    const count = insertMany(prices);
    log.info(`Bulk inserted ${count} baseline prices`);
    return count;
}

/**
 * Get baseline price for a player
 * Returns the most recent baseline if multiple exist
 */
export function getBaselinePrice(normalizedPlayerName: string): BaselinePrice | null {
    const db = getDb();

    const row = db.prepare<[string], BaselinePriceRow>(`
    SELECT * FROM baseline_prices
    WHERE normalized_player_name = ?
    ORDER BY article_date DESC
    LIMIT 1
  `).get(normalizedPlayerName);

    if (!row) return null;

    return rowToBaselinePrice(row);
}

/**
 * Get all baseline prices
 */
export function getAllBaselinePrices(): BaselinePrice[] {
    const db = getDb();

    const rows = db.prepare<[], BaselinePriceRow>(`
    SELECT * FROM baseline_prices
    ORDER BY normalized_player_name, article_date DESC
  `).all();

    // De-duplicate by player (keep most recent)
    const byPlayer = new Map<string, BaselinePriceRow>();
    for (const row of rows) {
        if (!byPlayer.has(row.normalized_player_name)) {
            byPlayer.set(row.normalized_player_name, row);
        }
    }

    return Array.from(byPlayer.values()).map(rowToBaselinePrice);
}

/**
 * Convert database row to BaselinePrice
 */
function rowToBaselinePrice(row: BaselinePriceRow): BaselinePrice {
    return {
        id: row.id,
        playerName: row.player_name,
        normalizedPlayerName: row.normalized_player_name,
        originalPrice: row.original_price,
        articleDate: new Date(row.article_date),
        articleSource: row.article_source,
        releaseYear: row.release_year || undefined,
        notes: row.notes || undefined,
        createdAt: new Date(row.created_at),
    };
}

// =============================================================================
// CURRENT MARKET OPERATIONS
// =============================================================================

/**
 * Insert or update current market data
 */
export function upsertCurrentMarket(market: CurrentMarketData): void {
    const db = getDb();

    const stmt = db.prepare(`
    INSERT INTO current_market (
      id, player_name, normalized_player_name, average_price,
      median_price, last_sale_price, last_sale_date, sample_size,
      verified_sales_json, fetched_at, card_type, inferred_year
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(normalized_player_name) DO UPDATE SET
      average_price = excluded.average_price,
      median_price = excluded.median_price,
      last_sale_price = excluded.last_sale_price,
      last_sale_date = excluded.last_sale_date,
      sample_size = excluded.sample_size,
      verified_sales_json = excluded.verified_sales_json,
      fetched_at = excluded.fetched_at,
      card_type = excluded.card_type,
      inferred_year = excluded.inferred_year
  `);

    const id = `market_${market.normalizedPlayerName}_${Date.now()}`;

    stmt.run(
        id,
        market.playerName,
        market.normalizedPlayerName,
        market.averagePrice,
        market.medianPrice,
        market.lastSalePrice,
        market.lastSaleDate.toISOString(),
        market.sampleSize,
        JSON.stringify(market.verifiedSales),
        market.fetchedAt.toISOString(),
        market.cardType || 'base',
        market.inferredYear
    );

    const typeIndicator = market.cardType === 'refractor' ? ' [REFRACTOR /499]' : '';
    const yearIndicator = market.inferredYear ? ` [${market.inferredYear}]` : '';
    log.debug(`Upserted market: ${market.playerName} @ $${market.averagePrice} avg${typeIndicator}${yearIndicator}`);
}

/**
 * Get current market data for a player
 */
export function getCurrentMarket(normalizedPlayerName: string): CurrentMarketData | null {
    const db = getDb();

    const row = db.prepare<[string], CurrentMarketRow>(`
    SELECT * FROM current_market
    WHERE normalized_player_name = ?
  `).get(normalizedPlayerName);

    if (!row) return null;

    return rowToCurrentMarket(row);
}

/**
 * Get all current market data
 */
export function getAllCurrentMarket(): CurrentMarketData[] {
    const db = getDb();

    const rows = db.prepare<[], CurrentMarketRow>(`
    SELECT * FROM current_market
  `).all();

    return rows.map(rowToCurrentMarket);
}

/**
 * Get stale market data (older than threshold)
 */
export function getStaleMarketData(staleThresholdHours: number): CurrentMarketData[] {
    const db = getDb();

    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - staleThresholdHours);

    const rows = db.prepare<[string], CurrentMarketRow>(`
    SELECT * FROM current_market
    WHERE fetched_at < ?
  `).all(thresholdDate.toISOString());

    return rows.map(rowToCurrentMarket);
}

/**
 * Convert database row to CurrentMarketData
 */
function rowToCurrentMarket(row: CurrentMarketRow): CurrentMarketData {
    return {
        playerName: row.player_name,
        normalizedPlayerName: row.normalized_player_name,
        averagePrice: row.average_price,
        medianPrice: row.median_price,
        lastSalePrice: row.last_sale_price,
        lastSaleDate: new Date(row.last_sale_date),
        sampleSize: row.sample_size,
        verifiedSales: JSON.parse(row.verified_sales_json) as CompSale[],
        fetchedAt: new Date(row.fetched_at),
        cardType: (row.card_type as 'base' | 'refractor') || 'base',
        inferredYear: row.inferred_year,
    };
}

// =============================================================================
// PRICE DELTA CALCULATIONS
// =============================================================================

/**
 * Calculate price delta between baseline and current market
 */
export function calculatePriceDelta(
    baseline: BaselinePrice,
    current: CurrentMarketData,
    config: Partial<CollectionConfig> = {}
): PriceDelta {
    const mergedConfig = { ...DEFAULT_COLLECTION_CONFIG, ...config };

    const absoluteChange = current.averagePrice - baseline.originalPrice;
    const percentageChange = baseline.originalPrice > 0
        ? (absoluteChange / baseline.originalPrice) * 100
        : 0;

    // Determine direction
    let direction: PriceDelta['direction'] = 'stable';
    if (absoluteChange > 0.5) direction = 'up';
    else if (absoluteChange < -0.5) direction = 'down';

    // Determine magnitude
    let magnitude: PriceDelta['magnitude'] = 'minimal';
    const absPercentage = Math.abs(percentageChange);
    if (absPercentage >= mergedConfig.significantChangeThreshold) {
        magnitude = 'significant';
    } else if (absPercentage >= mergedConfig.moderateChangeThreshold) {
        magnitude = 'moderate';
    }

    // Calculate days elapsed
    const msElapsed = current.fetchedAt.getTime() - baseline.articleDate.getTime();
    const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24));

    return {
        playerName: baseline.playerName,
        baselinePrice: baseline.originalPrice,
        baselineDate: baseline.articleDate,
        currentPrice: current.averagePrice,
        currentDate: current.fetchedAt,
        absoluteChange: Math.round(absoluteChange * 100) / 100,
        percentageChange: Math.round(percentageChange * 100) / 100,
        direction,
        magnitude,
        daysElapsed,
    };
}

// =============================================================================
// TRACKED CARD OPERATIONS
// =============================================================================

/**
 * Get all tracked cards with their full data
 */
export function getAllTrackedCards(config: Partial<CollectionConfig> = {}): TrackedCard[] {
    const mergedConfig = { ...DEFAULT_COLLECTION_CONFIG, ...config };

    const baselines = getAllBaselinePrices();
    const markets = getAllCurrentMarket();

    // Create lookup map for market data
    const marketByPlayer = new Map<string, CurrentMarketData>();
    for (const market of markets) {
        marketByPlayer.set(market.normalizedPlayerName, market);
    }

    // Build tracked cards
    const trackedCards: TrackedCard[] = [];

    for (const baseline of baselines) {
        const market = marketByPlayer.get(baseline.normalizedPlayerName);
        const ranking = PLAYER_RANKINGS.get(baseline.normalizedPlayerName);

        // Calculate delta if market data exists
        let priceDelta: PriceDelta | undefined;
        if (market) {
            priceDelta = calculatePriceDelta(baseline, market, mergedConfig);
        }

        // Determine if data is stale
        let isStale = true;
        if (market) {
            const ageMs = Date.now() - market.fetchedAt.getTime();
            const ageHours = ageMs / (1000 * 60 * 60);
            isStale = ageHours > mergedConfig.staleThresholdHours;
        }

        trackedCards.push({
            id: baseline.id,
            playerName: baseline.playerName,
            normalizedPlayerName: baseline.normalizedPlayerName,
            hobbyRanking: ranking,
            // Priority: market.inferredYear > baseline.releaseYear > config.targetReleaseYear
            // This ensures we use the actual 1st Bowman year from sales data
            releaseYear: market?.inferredYear || baseline.releaseYear || mergedConfig.targetReleaseYear,
            baseline,
            currentMarket: market,
            priceDelta,
            lastUpdated: market?.fetchedAt || baseline.createdAt,
            isStale,
        });
    }

    return trackedCards;
}

/**
 * Get dashboard statistics
 */
export function getDashboardStats(config: Partial<CollectionConfig> = {}): DashboardStats {
    const cards = getAllTrackedCards(config);

    let cardsUp = 0;
    let cardsDown = 0;
    let cardsStable = 0;
    let totalChange = 0;
    let staleCardCount = 0;

    let topGainer: DashboardStats['topGainer'];
    let topLoser: DashboardStats['topLoser'];

    let maxGain = -Infinity;
    let maxLoss = Infinity;

    for (const card of cards) {
        if (card.isStale) staleCardCount++;

        if (card.priceDelta) {
            totalChange += card.priceDelta.percentageChange;

            switch (card.priceDelta.direction) {
                case 'up':
                    cardsUp++;
                    if (card.priceDelta.percentageChange > maxGain) {
                        maxGain = card.priceDelta.percentageChange;
                        topGainer = {
                            playerName: card.playerName,
                            percentageChange: card.priceDelta.percentageChange,
                        };
                    }
                    break;
                case 'down':
                    cardsDown++;
                    if (card.priceDelta.percentageChange < maxLoss) {
                        maxLoss = card.priceDelta.percentageChange;
                        topLoser = {
                            playerName: card.playerName,
                            percentageChange: card.priceDelta.percentageChange,
                        };
                    }
                    break;
                default:
                    cardsStable++;
            }
        }
    }

    const averageChange = cards.length > 0
        ? Math.round((totalChange / cards.length) * 100) / 100
        : 0;

    return {
        totalCards: cards.length,
        cardsUp,
        cardsDown,
        cardsStable,
        averageChange,
        topGainer,
        topLoser,
        lastRefresh: new Date(),
        staleCardCount,
    };
}

// =============================================================================
// PRICE HISTORY OPERATIONS
// =============================================================================

interface PriceHistoryEntry {
    id: string;
    normalizedPlayerName: string;
    averagePrice: number;
    medianPrice: number | null;
    lastSalePrice: number | null;
    sampleSize: number | null;
    snapshotDate: string;
    createdAt: Date;
}

interface PriceHistoryRow {
    id: string;
    normalized_player_name: string;
    average_price: number;
    median_price: number | null;
    last_sale_price: number | null;
    sample_size: number | null;
    snapshot_date: string;
    created_at: string;
}

/**
 * Record a price snapshot for a player
 * Uses INSERT OR REPLACE to update if same day
 */
export function recordPriceSnapshot(
    normalizedPlayerName: string,
    averagePrice: number,
    medianPrice?: number | null,
    lastSalePrice?: number | null,
    sampleSize?: number | null,
    snapshotDate?: string
): void {
    const database = getDb();
    const today = snapshotDate || new Date().toISOString().split('T')[0];
    const id = `${normalizedPlayerName}-${today}`;

    const stmt = database.prepare(`
        INSERT OR REPLACE INTO price_history 
        (id, normalized_player_name, average_price, median_price, last_sale_price, sample_size, snapshot_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        id,
        normalizedPlayerName,
        averagePrice,
        medianPrice ?? null,
        lastSalePrice ?? null,
        sampleSize ?? null,
        today,
        new Date().toISOString()
    );
}

/**
 * Record price snapshots for all current market data
 * Should be called daily (e.g., via cron or after refresh)
 */
export function recordAllPriceSnapshots(): number {
    const database = getDb();
    const today = new Date().toISOString().split('T')[0];

    const stmt = database.prepare(`
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
    `);

    const result = stmt.run(today, today, new Date().toISOString());
    log.info(`Recorded ${result.changes} price snapshots for ${today}`);
    return result.changes;
}

/**
 * Get price history for a player
 */
export function getPriceHistory(
    normalizedPlayerName: string,
    daysBack: number = 90
): PriceHistoryEntry[] {
    const database = getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const rows = database.prepare(`
        SELECT * FROM price_history
        WHERE normalized_player_name = ?
        AND snapshot_date >= ?
        ORDER BY snapshot_date ASC
    `).all(normalizedPlayerName, cutoffDate.toISOString().split('T')[0]) as PriceHistoryRow[];

    return rows.map(row => ({
        id: row.id,
        normalizedPlayerName: row.normalized_player_name,
        averagePrice: row.average_price,
        medianPrice: row.median_price,
        lastSalePrice: row.last_sale_price,
        sampleSize: row.sample_size,
        snapshotDate: row.snapshot_date,
        createdAt: new Date(row.created_at),
    }));
}

/**
 * Get price history for all players (for dashboard overview)
 */
export function getAllPriceHistory(daysBack: number = 30): Map<string, PriceHistoryEntry[]> {
    const database = getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const rows = database.prepare(`
        SELECT * FROM price_history
        WHERE snapshot_date >= ?
        ORDER BY normalized_player_name, snapshot_date ASC
    `).all(cutoffDate.toISOString().split('T')[0]) as PriceHistoryRow[];

    const historyMap = new Map<string, PriceHistoryEntry[]>();

    for (const row of rows) {
        const entry: PriceHistoryEntry = {
            id: row.id,
            normalizedPlayerName: row.normalized_player_name,
            averagePrice: row.average_price,
            medianPrice: row.median_price,
            lastSalePrice: row.last_sale_price,
            sampleSize: row.sample_size,
            snapshotDate: row.snapshot_date,
            createdAt: new Date(row.created_at),
        };

        const existing = historyMap.get(row.normalized_player_name) || [];
        existing.push(entry);
        historyMap.set(row.normalized_player_name, existing);
    }

    return historyMap;
}

/**
 * Get latest snapshot date
 */
export function getLatestSnapshotDate(): string | null {
    const database = getDb();
    const row = database.prepare(`
        SELECT MAX(snapshot_date) as latest FROM price_history
    `).get() as { latest: string | null };

    return row?.latest || null;
}

/**
 * Get price change between two dates
 */
export function getPriceChange(
    normalizedPlayerName: string,
    startDate: string,
    endDate: string
): { startPrice: number; endPrice: number; change: number; percentChange: number } | null {
    const database = getDb();

    const startRow = database.prepare(`
        SELECT average_price FROM price_history
        WHERE normalized_player_name = ? AND snapshot_date <= ?
        ORDER BY snapshot_date DESC LIMIT 1
    `).get(normalizedPlayerName, startDate) as { average_price: number } | undefined;

    const endRow = database.prepare(`
        SELECT average_price FROM price_history
        WHERE normalized_player_name = ? AND snapshot_date <= ?
        ORDER BY snapshot_date DESC LIMIT 1
    `).get(normalizedPlayerName, endDate) as { average_price: number } | undefined;

    if (!startRow || !endRow) return null;

    const change = endRow.average_price - startRow.average_price;
    const percentChange = startRow.average_price > 0
        ? (change / startRow.average_price) * 100
        : 0;

    return {
        startPrice: startRow.average_price,
        endPrice: endRow.average_price,
        change,
        percentChange,
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
    DB_PATH,
};

export type { PriceHistoryEntry };
