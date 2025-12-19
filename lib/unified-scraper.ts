/**
 * =============================================================================
 * UNIFIED SCRAPER - Single Source of Truth for Sales Data
 * =============================================================================
 * 
 * Scrapes 130point.com/cards/ API and stores ALL valid sales in database.
 * 
 * Key Features:
 * - Uses POST to /cards/ endpoint (no proxies needed)
 * - Stores individual sales in database for charting
 * - Calculates market averages from 5 most recent sales
 * - Filters to base autos by year (no "1st" required in title)
 * - Falls back to refractor /499 if no base autos found
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedSale {
    title: string;
    ebayUrl: string;
    ebayItemId: string;
    salePrice: number;
    saleDate: Date;
    saleType: string;
    releaseYear: number | null;
    currency: string;
}

export interface FilteredSale extends ParsedSale {
    isBaseAuto: boolean;
    isRefractor: boolean;
    exclusionReason?: string;
}

export interface ScrapeResult {
    playerName: string;
    normalizedPlayerName: string;
    success: boolean;

    // What we found
    totalResultsFromApi: number;
    baseAutosFiltered: number;
    refractorsFiltered: number;

    // Year detection
    inferredFirstBowmanYear: number | null;

    // Sales stored
    salesInserted: number;
    salesDuplicate: number;
    salesTotal: number;

    // Market stats (from 5 most recent)
    cardType: 'base' | 'refractor' | null;
    averagePrice: number | null;
    medianPrice: number | null;
    lastSalePrice: number | null;
    lastSaleDate: Date | null;
    sampleSize: number;

    // Timing
    responseTimeMs: number;

    // Error if failed
    error?: {
        code: string;
        message: string;
    };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const API_ENDPOINT = 'https://back.130point.com/cards/';

// Parallel/color indicators to EXCLUDE for base autos
const PARALLEL_COLORS = [
    'refractor', 'shimmer', 'speckle', 'mojo', 'lava', 'wave',
    'sapphire', 'aqua', 'sky blue',
    'purple', 'blue', 'green', 'gold', 'orange', 'red', 'yellow', 'pink', 'black',
    'atomic', 'prism', 'hyper', 'x-fractor',
];

// Graded card indicators
const GRADED_INDICATORS = [
    'psa', 'bgs', 'sgc', 'cgc', 'hga', 'csg',
    'gem mint', 'gem mt 10', 'mint 9', 'perfect 10', 'pristine',
];

// Lot indicators - text patterns
const LOT_INDICATORS = [
    '(2)', '(3)', '(4)', '(5)', '(6)', '(10)', '(20)',
    '[2]', '[3]', '[4]', '[5]', '[6]', '[10]', '[20]',
    'lot', 'bundle', 'set of', 'collection of', 'group',
    '& ', ' and ', ' + ',
];

// Regex patterns for lot quantities like (x2), [x3], (2x), x4, etc.
const LOT_QUANTITY_PATTERNS = [
    /\(x\d+\)/i,      // (x2), (x3), (X10)
    /\[x\d+\]/i,      // [x2], [x3]
    /\(\d+x\)/i,      // (2x), (3x)
    /\[\d+x\]/i,      // [2x], [3x]
    /\bx\d+\b/i,      // x2, x3 (standalone)
    /\(\d+\s*cards?\)/i,  // (2 cards), (3 card)
    /\[\d+\s*cards?\]/i,  // [2 cards], [3 card]
];

// Excluded products (not Bowman Chrome prospects)
// Note: 'draft' was removed - Bowman Chrome Draft IS a valid Bowman Chrome product
const EXCLUDED_PRODUCTS = [
    'topps chrome', 'panini', 'donruss', 'prizm', 'contenders',
    'leaf', 'sterling', 'heritage', 'finest',
    'arizona fall league', 'fall league', 'aflac',
    'redemption', 'vip', 'relic', 'patch',
    'bunt', 'digital', 'nft', 'virtual',
    'bowman u', 'bowman university',  // College products, not prospect products
    'mega',  // Mega Box exclusives are different parallels
];

// In-Person (IP) autograph indicators - these are AFTER-MARKET signatures, not on-card autos!
// We want factory on-card autos only, not signed in-person at events
const IP_AUTOGRAPH_INDICATORS = [
    ' ip ',           // "IP" standalone (space-padded to avoid matching "chip")
    ' ip auto',       // "IP Auto"
    'in person',      // "In Person"
    'in-person',      // "In-Person"
    'signed in',      // "Signed in person"
    'signed at',      // "Signed at event"
    'signed by',      // "Signed by player" (usually IP)
    'hand signed',    // "Hand Signed" (usually aftermarket)
    'hand-signed',    // "Hand-Signed"
    'authentic auto', // Often used for IP autos
    'convention',     // Convention/event signings
    'meet and greet', // Meet and greet signings
    'autograph event',// Event signings
    'signing event',  // Signing events
];

// Serial number pattern (indicates numbered parallel)
const SERIAL_PATTERN = /\/\d{1,4}\b/;

// Year extraction pattern
const YEAR_PATTERN = /\b(20[1-2][0-9])\b/g;

// =============================================================================
// LOGGING
// =============================================================================

const log = {
    info: (msg: string, ...args: unknown[]) => console.log(`[Unified Scraper] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[Unified Scraper] ⚠️ ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[Unified Scraper] ❌ ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => {
        if (process.env.DEBUG) console.log(`[Unified Scraper] 🐛 ${msg}`, ...args);
    },
    success: (msg: string, ...args: unknown[]) => console.log(`[Unified Scraper] ✓ ${msg}`, ...args),
};

// =============================================================================
// API QUERY
// =============================================================================

/**
 * Query the 130point /cards/ API
 * Returns raw parsed sales from HTML response
 * @param playerName - Player name to search
 * @param targetYear - Optional year for more targeted search (e.g., "2022")
 */
async function query130PointCards(playerName: string, targetYear?: number): Promise<ParsedSale[]> {
    // Build search query - include year if provided for more targeted results
    // Example: "Termarr Johnson 2022 Bowman Chrome Auto" vs "Termarr Johnson Bowman Chrome Auto"
    const searchQuery = targetYear
        ? `${playerName} ${targetYear} bowman chrome auto`
        : `${playerName} bowman chrome auto`;

    log.info(`Querying API for: "${searchQuery}"`);
    const startTime = Date.now();

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `query=${encodeURIComponent(searchQuery)}`,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const sales = parseHtmlResponse(html);

        log.info(`Found ${sales.length} sales in ${Date.now() - startTime}ms`);
        return sales;
    } catch (error) {
        log.error(`API query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}

/**
 * Parse HTML response from 130point into structured sales data
 */
function parseHtmlResponse(html: string): ParsedSale[] {
    const sales: ParsedSale[] = [];

    // Match each row - use a simpler pattern that doesn't depend on attribute order
    // The TR tag has: id="dRow", data-price, data-check (eBay ID), data-currency
    const rowPattern = /<tr[^>]*id="dRow"[^>]*>([\s\S]*?)<\/tr>/gi;

    let match;
    while ((match = rowPattern.exec(html)) !== null) {
        const fullRow = match[0]; // includes the opening tr tag
        const rowContent = match[1];

        // Extract data attributes from the opening TR tag
        const priceMatch = fullRow.match(/data-price="([^"]+)"/);
        const checkMatch = fullRow.match(/data-check="([^"]+)"/);
        const currencyMatch = fullRow.match(/data-currency="([^"]+)"/);

        if (!priceMatch || !checkMatch || !currencyMatch) continue;

        const price = parseFloat(priceMatch[1]);
        const ebayItemId = checkMatch[1];
        const currency = currencyMatch[1];

        // Skip non-USD for now (can add currency conversion later)
        if (currency !== 'USD') continue;

        // Extract title from anchor tag
        const titleMatch = rowContent.match(/<a[^>]*href='(https:\/\/www\.ebay\.com\/itm\/[^']+)'[^>]*>([^<]+)<\/a>/);
        if (!titleMatch) continue;

        // Normalize the URL immediately to strip query params
        const rawEbayUrl = titleMatch[1];
        const ebayUrl = normalizeEbayUrl(rawEbayUrl);
        const title = titleMatch[2].trim();

        // Extract sale type
        let saleType = 'Unknown';
        if (rowContent.includes('Fixed Price Sale')) saleType = 'Buy It Now';
        else if (rowContent.includes('Auction')) saleType = 'Auction';
        else if (rowContent.includes('Best Offer')) saleType = 'Best Offer';

        // Extract date
        const dateMatch = rowContent.match(/Date:<\/b>\s*([^<]+)</);
        let saleDate = new Date();
        if (dateMatch) {
            const parsedDate = new Date(dateMatch[1].trim());
            if (!isNaN(parsedDate.getTime())) {
                saleDate = parsedDate;
            }
        }

        // Extract year from title
        const releaseYear = extractYear(title);

        sales.push({
            title,
            ebayUrl,  // Already normalized
            ebayItemId,
            salePrice: price,
            saleDate,
            saleType,
            releaseYear,
            currency,
        });
    }

    // Deduplicate by eBay item ID (same listing appearing multiple times in results)
    const seenItemIds = new Set<string>();
    const deduplicatedSales = sales.filter(sale => {
        if (seenItemIds.has(sale.ebayItemId)) {
            return false;  // Skip duplicate
        }
        seenItemIds.add(sale.ebayItemId);
        return true;
    });

    if (deduplicatedSales.length < sales.length) {
        log.warn(`Deduplicated ${sales.length - deduplicatedSales.length} duplicate listings from API response`);
    }

    return deduplicatedSales;
}

/**
 * Extract 4-digit year from title
 */
function extractYear(title: string): number | null {
    const matches = title.match(YEAR_PATTERN);
    if (matches && matches.length > 0) {
        // Return the first year found (typically the product year)
        return parseInt(matches[0], 10);
    }
    return null;
}

/**
 * Normalize eBay URL to strip query parameters for consistent duplicate detection
 * e.g., "https://www.ebay.com/itm/277455452696?nordt=true" -> "https://www.ebay.com/itm/277455452696"
 */
function normalizeEbayUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        // Strip all query parameters
        return `${urlObj.origin}${urlObj.pathname}`;
    } catch {
        // If URL parsing fails, at least strip everything after ?
        return url.split('?')[0];
    }
}

/**
 * Check if a listing title contains the player's name
 * Handles variations like hyphenated names (Fitz-Gerald vs FitzGerald)
 */
function titleContainsPlayerName(title: string, playerName: string): boolean {
    const lowerTitle = title.toLowerCase();
    const lowerName = playerName.toLowerCase();

    // Split player name into parts (first, last, etc.)
    const nameParts = lowerName.split(/[\s-]+/).filter(p => p.length > 2);

    // Check if ALL significant name parts appear in the title
    // For "Devin Fitz-Gerald", we check for "devin", "fitz", "gerald"
    for (const part of nameParts) {
        if (!lowerTitle.includes(part)) {
            return false;
        }
    }

    return nameParts.length > 0;
}

// =============================================================================
// FILTERING LOGIC
// =============================================================================

/**
 * Determine if a sale is a base auto (no parallels, no numbered, no graded)
 */
function categorizeListingSale(sale: ParsedSale): FilteredSale {
    const lowerTitle = sale.title.toLowerCase();

    let isBaseAuto = true;
    let isRefractor = false;
    let exclusionReason: string | undefined;

    // Check for graded cards
    for (const graded of GRADED_INDICATORS) {
        if (lowerTitle.includes(graded)) {
            isBaseAuto = false;
            exclusionReason = `Graded card: ${graded}`;
            break;
        }
    }

    // Check for lots - text patterns
    if (isBaseAuto) {
        for (const lot of LOT_INDICATORS) {
            if (lowerTitle.includes(lot)) {
                isBaseAuto = false;
                exclusionReason = `Lot/bundle: ${lot}`;
                break;
            }
        }
    }

    // Check for lots - regex patterns like (x2), [4], x3, etc.
    if (isBaseAuto) {
        for (const pattern of LOT_QUANTITY_PATTERNS) {
            const match = sale.title.match(pattern);
            if (match) {
                isBaseAuto = false;
                exclusionReason = `Lot quantity: ${match[0]}`;
                break;
            }
        }
    }

    // Check for excluded products
    if (isBaseAuto) {
        for (const product of EXCLUDED_PRODUCTS) {
            if (lowerTitle.includes(product)) {
                isBaseAuto = false;
                exclusionReason = `Wrong product: ${product}`;
                break;
            }
        }
    }

    // Check for in-person (IP) autographs - these are AFTER-MARKET, not on-card autos!
    if (isBaseAuto) {
        for (const ipIndicator of IP_AUTOGRAPH_INDICATORS) {
            if (lowerTitle.includes(ipIndicator)) {
                isBaseAuto = false;
                isRefractor = false; // IP autos should never be used, even as fallback
                exclusionReason = `IP/aftermarket auto: ${ipIndicator.trim()}`;
                break;
            }
        }
    }

    // Check for serial numbers (numbered parallel)
    if (isBaseAuto && SERIAL_PATTERN.test(sale.title)) {
        isBaseAuto = false;
        exclusionReason = 'Numbered parallel';

        // Check if it's specifically a /499 refractor
        if (lowerTitle.includes('/499') && lowerTitle.includes('refractor')) {
            isRefractor = true;
        }
    }

    // Check for parallel colors
    if (isBaseAuto) {
        for (const color of PARALLEL_COLORS) {
            if (lowerTitle.includes(color)) {
                isBaseAuto = false;
                exclusionReason = `Parallel: ${color}`;

                // Special case: refractor without serial is still a parallel, but /499 refractor is tracked
                if (color === 'refractor' && lowerTitle.includes('/499')) {
                    isRefractor = true;
                }
                break;
            }
        }
    }

    return {
        ...sale,
        isBaseAuto,
        isRefractor,
        exclusionReason,
    };
}

/**
 * Determine the 1st Bowman year from a set of sales
 * Uses the earliest year where we have sales (no "1st" required in title)
 */
function determineFirstBowmanYear(sales: FilteredSale[]): number | null {
    // Collect years from base autos
    const yearCounts = new Map<number, number>();

    for (const sale of sales) {
        if (sale.releaseYear && sale.isBaseAuto) {
            yearCounts.set(sale.releaseYear, (yearCounts.get(sale.releaseYear) || 0) + 1);
        }
    }

    if (yearCounts.size === 0) {
        // Try refractors as fallback
        for (const sale of sales) {
            if (sale.releaseYear && sale.isRefractor) {
                yearCounts.set(sale.releaseYear, (yearCounts.get(sale.releaseYear) || 0) + 1);
            }
        }
    }

    if (yearCounts.size === 0) return null;

    // Return the EARLIEST year (first Bowman appearance)
    const years = Array.from(yearCounts.keys()).sort((a, b) => a - b);
    return years[0];
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'collection_data.db');
let db: Database.Database | null = null;

function getDb(): Database.Database {
    if (!db) {
        db = new Database(DB_PATH);

        // Ensure individual_sales table exists
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
            CREATE INDEX IF NOT EXISTS idx_sales_date ON individual_sales(sale_date);
            CREATE INDEX IF NOT EXISTS idx_sales_year ON individual_sales(release_year);
        `);

        // Migration: Add card_type column if it doesn't exist
        try {
            db.exec(`ALTER TABLE individual_sales ADD COLUMN card_type TEXT DEFAULT 'base'`);
            log.info('Migration: Added card_type column to individual_sales');
        } catch {
            // Column already exists, ignore
        }
    }
    return db;
}

/**
 * Check if a sale already exists in the database (by normalized eBay URL)
 */
function saleExists(ebayUrl: string): boolean {
    const db = getDb();
    const normalizedUrl = normalizeEbayUrl(ebayUrl);
    // Check both normalized and original URL for backwards compatibility
    const row = db.prepare(`
        SELECT 1 FROM individual_sales 
        WHERE ebay_url = ? OR ebay_url LIKE ?
    `).get(normalizedUrl, normalizedUrl + '%');
    return !!row;
}

/**
 * Insert a sale into the database
 * Returns true if inserted, false if duplicate
 */
function insertSale(
    playerName: string,
    sale: FilteredSale,
    cardType: 'base' | 'refractor'
): boolean {
    // Normalize the URL to prevent duplicates with different query params
    const normalizedUrl = normalizeEbayUrl(sale.ebayUrl);

    if (saleExists(normalizedUrl)) {
        return false;
    }

    const db = getDb();
    const stmt = db.prepare(`
        INSERT INTO individual_sales (
            id, player_name, normalized_player_name, ebay_url, ebay_item_id,
            title, sale_price, sale_date, sale_type, release_year, card_type, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        uuidv4(),
        playerName,
        playerName.toLowerCase().trim(),
        normalizedUrl,  // Store normalized URL
        sale.ebayItemId,
        sale.title,
        sale.salePrice,
        sale.saleDate.toISOString(),
        sale.saleType,
        sale.releaseYear,
        cardType,
        new Date().toISOString()
    );

    return true;
}

/**
 * Get sales from database for a player
 * @param playerName - Player name to search for
 * @param releaseYear - Optional year filter
 * @param limit - Optional limit on results
 * @param daysBack - Optional date cutoff (sales within last N days)
 */
export function getPlayerSalesFromDb(
    playerName: string,
    releaseYear?: number,
    limit?: number,
    daysBack?: number
): Array<{
    id: string;
    title: string;
    salePrice: number;
    saleDate: Date;
    saleType: string;
    ebayUrl: string;
    releaseYear: number | null;
    cardType: string;
}> {
    const db = getDb();
    const normalizedName = playerName.toLowerCase().trim();

    let query = `
        SELECT * FROM individual_sales 
        WHERE normalized_player_name = ?
    `;
    const params: (string | number)[] = [normalizedName];

    if (releaseYear) {
        query += ` AND release_year = ?`;
        params.push(releaseYear);
    }

    // Add date filter at database level for efficiency
    if (daysBack && daysBack > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        query += ` AND sale_date >= ?`;
        params.push(cutoffDate.toISOString());
    }

    query += ` ORDER BY sale_date DESC`;

    if (limit) {
        query += ` LIMIT ?`;
        params.push(limit);
    }

    const rows = db.prepare(query).all(...params) as Array<{
        id: string;
        title: string;
        sale_price: number;
        sale_date: string;
        sale_type: string;
        ebay_url: string;
        release_year: number | null;
        card_type: string;
    }>;

    return rows.map(row => ({
        id: row.id,
        title: row.title,
        salePrice: row.sale_price,
        saleDate: new Date(row.sale_date),
        saleType: row.sale_type,
        ebayUrl: row.ebay_url,
        releaseYear: row.release_year,
        cardType: row.card_type,
    }));
}

/**
 * Get total sales count for a player
 */
export function getPlayerSalesCount(playerName: string, releaseYear?: number): number {
    const db = getDb();
    const normalizedName = playerName.toLowerCase().trim();

    let query = `SELECT COUNT(*) as count FROM individual_sales WHERE normalized_player_name = ?`;
    const params: (string | number)[] = [normalizedName];

    if (releaseYear) {
        query += ` AND release_year = ?`;
        params.push(releaseYear);
    }

    const row = db.prepare(query).get(...params) as { count: number };
    return row.count;
}

// =============================================================================
// MAIN SCRAPE FUNCTION
// =============================================================================

/**
 * Scrape and store all sales for a player
 * 
 * This is the main entry point. It:
 * 1. Queries 130point API for all matching sales
 * 2. Categorizes each sale (base auto, refractor, excluded)
 * 3. Determines the 1st Bowman year (or uses provided targetYear)
 * 4. Stores all valid sales in database
 * 5. Returns market stats from 5 most recent
 * 
 * @param playerName - Player name to scrape
 * @param targetYear - Optional known 1st Bowman year for targeted search
 */
export async function scrapeAndStorePlayer(playerName: string, targetYear?: number): Promise<ScrapeResult> {
    const startTime = Date.now();
    const normalizedName = playerName.toLowerCase().trim();

    log.info(`Starting scrape for: ${playerName}${targetYear ? ` [${targetYear}]` : ''}`);

    try {
        // Step 1: Query API (with year if provided for more targeted results)
        const rawSales = await query130PointCards(playerName, targetYear);

        if (rawSales.length === 0) {
            return {
                playerName,
                normalizedPlayerName: normalizedName,
                success: false,
                totalResultsFromApi: 0,
                baseAutosFiltered: 0,
                refractorsFiltered: 0,
                inferredFirstBowmanYear: targetYear || null,
                salesInserted: 0,
                salesDuplicate: 0,
                salesTotal: 0,
                cardType: null,
                averagePrice: null,
                medianPrice: null,
                lastSalePrice: null,
                lastSaleDate: null,
                sampleSize: 0,
                responseTimeMs: Date.now() - startTime,
                error: {
                    code: 'NO_RESULTS',
                    message: 'No results returned from API',
                },
            };
        }

        // Step 2: Categorize all sales
        const categorizedSales = rawSales.map(categorizeListingSale);

        // Step 2b: Filter to only sales that actually contain the player's name
        // This prevents wrong player cards from being included (e.g., "Bowman U" products)
        const nameMatchedSales = categorizedSales.filter(s => titleContainsPlayerName(s.title, playerName));
        const nameFilteredCount = categorizedSales.length - nameMatchedSales.length;
        if (nameFilteredCount > 0) {
            log.warn(`Filtered ${nameFilteredCount} sales that don't match player name`);
        }

        const baseAutos = nameMatchedSales.filter(s => s.isBaseAuto);
        const refractors = nameMatchedSales.filter(s => s.isRefractor);

        log.info(`Categorized: ${baseAutos.length} base autos, ${refractors.length} refractors /499`);

        // Step 3: Determine 1st Bowman year (use provided targetYear if available)
        const firstYear = targetYear || determineFirstBowmanYear(categorizedSales);
        log.info(`1st Bowman year: ${firstYear || 'unknown'}${targetYear ? ' (provided)' : ' (inferred)'}`);

        // Step 4: Filter to only 1st year sales
        let salesToStore: FilteredSale[] = [];
        let cardType: 'base' | 'refractor' = 'base';

        if (firstYear) {
            // Filter base autos to 1st year
            const firstYearBaseAutos = baseAutos.filter(s => s.releaseYear === firstYear);

            if (firstYearBaseAutos.length > 0) {
                salesToStore = firstYearBaseAutos;
                cardType = 'base';
                log.info(`Using ${firstYearBaseAutos.length} base autos from ${firstYear}`);
            } else {
                // Fallback to refractors from 1st year
                const firstYearRefractors = refractors.filter(s => s.releaseYear === firstYear);
                if (firstYearRefractors.length > 0) {
                    salesToStore = firstYearRefractors;
                    cardType = 'refractor';
                    log.info(`Fallback: Using ${firstYearRefractors.length} refractors /499 from ${firstYear}`);
                }
            }
        } else {
            // No year detected - use all base autos
            if (baseAutos.length > 0) {
                salesToStore = baseAutos;
                cardType = 'base';
            } else if (refractors.length > 0) {
                salesToStore = refractors;
                cardType = 'refractor';
            }
        }

        if (salesToStore.length === 0) {
            return {
                playerName,
                normalizedPlayerName: normalizedName,
                success: false,
                totalResultsFromApi: rawSales.length,
                baseAutosFiltered: baseAutos.length,
                refractorsFiltered: refractors.length,
                inferredFirstBowmanYear: firstYear,
                salesInserted: 0,
                salesDuplicate: 0,
                salesTotal: 0,
                cardType: null,
                averagePrice: null,
                medianPrice: null,
                lastSalePrice: null,
                lastSaleDate: null,
                sampleSize: 0,
                responseTimeMs: Date.now() - startTime,
                error: {
                    code: 'NO_VALID_SALES',
                    message: `No base autos or refractors found for ${firstYear || 'any'} year`,
                },
            };
        }

        // Step 5: Store sales in database
        let inserted = 0;
        let duplicates = 0;

        for (const sale of salesToStore) {
            const wasInserted = insertSale(playerName, sale, cardType);
            if (wasInserted) {
                inserted++;
            } else {
                duplicates++;
            }
        }

        log.info(`Stored: ${inserted} new, ${duplicates} duplicates`);

        // Step 6: Calculate market stats from database (5 most recent)
        const recentSales = getPlayerSalesFromDb(normalizedName, firstYear || undefined, 5);

        let averagePrice: number | null = null;
        let medianPrice: number | null = null;
        let lastSalePrice: number | null = null;
        let lastSaleDate: Date | null = null;

        if (recentSales.length > 0) {
            const prices = recentSales.map(s => s.salePrice).sort((a, b) => a - b);
            averagePrice = Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;

            const mid = Math.floor(prices.length / 2);
            medianPrice = prices.length % 2 !== 0
                ? prices[mid]
                : Math.round(((prices[mid - 1] + prices[mid]) / 2) * 100) / 100;

            lastSalePrice = recentSales[0].salePrice;
            lastSaleDate = recentSales[0].saleDate;
        }

        const totalSalesInDb = getPlayerSalesCount(normalizedName, firstYear || undefined);

        log.success(`${playerName}: Avg $${averagePrice}, Median $${medianPrice} (n=${recentSales.length}) [${firstYear || '?'}] ${cardType === 'refractor' ? '[REFRACTOR /499]' : ''}`);

        return {
            playerName,
            normalizedPlayerName: normalizedName,
            success: true,
            totalResultsFromApi: rawSales.length,
            baseAutosFiltered: baseAutos.length,
            refractorsFiltered: refractors.length,
            inferredFirstBowmanYear: firstYear,
            salesInserted: inserted,
            salesDuplicate: duplicates,
            salesTotal: totalSalesInDb,
            cardType,
            averagePrice,
            medianPrice,
            lastSalePrice,
            lastSaleDate,
            sampleSize: recentSales.length,
            responseTimeMs: Date.now() - startTime,
        };

    } catch (error) {
        log.error(`Scrape failed for ${playerName}: ${error instanceof Error ? error.message : 'Unknown error'}`);

        return {
            playerName,
            normalizedPlayerName: normalizedName,
            success: false,
            totalResultsFromApi: 0,
            baseAutosFiltered: 0,
            refractorsFiltered: 0,
            inferredFirstBowmanYear: null,
            salesInserted: 0,
            salesDuplicate: 0,
            salesTotal: 0,
            cardType: null,
            averagePrice: null,
            medianPrice: null,
            lastSalePrice: null,
            lastSaleDate: null,
            sampleSize: 0,
            responseTimeMs: Date.now() - startTime,
            error: {
                code: 'SCRAPE_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
        };
    }
}

/**
 * Scrape multiple players with rate limiting
 */
export async function scrapeMultiplePlayers(
    playerNames: string[],
    delayMs = 1500
): Promise<Map<string, ScrapeResult>> {
    const results = new Map<string, ScrapeResult>();

    log.info(`Starting batch scrape of ${playerNames.length} players`);

    for (let i = 0; i < playerNames.length; i++) {
        const player = playerNames[i];
        log.info(`[${i + 1}/${playerNames.length}] Processing: ${player}`);

        const result = await scrapeAndStorePlayer(player);
        results.set(player.toLowerCase().trim(), result);

        // Rate limiting between requests
        if (i < playerNames.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    const successful = Array.from(results.values()).filter(r => r.success).length;
    log.success(`Batch complete: ${successful}/${playerNames.length} successful`);

    return results;
}
