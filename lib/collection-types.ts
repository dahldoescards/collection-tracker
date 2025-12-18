/**
 * =============================================================================
 * COLLECTION TYPES - TypeScript Interfaces for Price Tracking Dashboard
 * =============================================================================
 * 
 * Production-quality type definitions for the Collection tool.
 * Includes all interfaces for parsing, scraping, and UI components.
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

// =============================================================================
// ARTICLE PARSING TYPES
// =============================================================================

/**
 * Represents a parsed baseline price from a BigBobCards article
 */
export interface BaselinePrice {
    /** Unique identifier for this baseline record */
    id: string;

    /** Player name as extracted from the article */
    playerName: string;

    /** Normalized player name for matching (lowercase, trimmed) */
    normalizedPlayerName: string;

    /** Price reported in the article (in USD) */
    originalPrice: number;

    /** Date the article was published */
    articleDate: Date;

    /** URL or identifier of the source article */
    articleSource: string;

    /** Release year of the card (e.g., 2024) */
    releaseYear?: number;

    /** Additional notes from the article */
    notes?: string;

    /** Timestamp when this record was created */
    createdAt: Date;
}

/**
 * Raw article data before parsing
 */
export interface RawArticle {
    /** Article content as plain text or HTML */
    content: string;

    /** Publication date string (various formats supported) */
    dateString: string;

    /** Source URL or identifier */
    source: string;
}

/**
 * Result of parsing a BigBobCards article
 */
export interface ArticleParseResult {
    /** Successfully parsed baseline prices */
    prices: BaselinePrice[];

    /** Lines that could not be parsed */
    unparsedLines: string[];

    /** Any errors encountered during parsing */
    errors: ParseError[];

    /** Metadata about the parsing operation */
    metadata: {
        totalLines: number;
        successfullyParsed: number;
        parseRate: number;
        articleDate: Date;
    };
}

/**
 * Error encountered during parsing
 */
export interface ParseError {
    line: string;
    lineNumber: number;
    reason: string;
}

// =============================================================================
// SCRAPING TYPES
// =============================================================================

/**
 * Comparable sale from 130point.com
 */
export interface CompSale {
    /** Listing title from eBay */
    title: string;

    /** Direct URL to the eBay listing */
    url: string;

    /** Final sale price in USD */
    salePrice: number;

    /** Date of the sale */
    saleDate: Date;

    /** Type of sale (Auction, Buy It Now, Best Offer) */
    saleType: 'Auction' | 'Buy It Now' | 'Best Offer' | 'Unknown';

    /** Whether this matches our strict base auto criteria */
    isVerifiedBaseAuto: boolean;

    /** Reason for exclusion if not a base auto */
    exclusionReason?: string;
}

/**
 * Current market data for a player
 */
export interface CurrentMarketData {
    /** Player name */
    playerName: string;

    /** Normalized player name for matching */
    normalizedPlayerName: string;

    /** Average price of recent base auto sales */
    averagePrice: number;

    /** Median price of recent sales */
    medianPrice: number;

    /** Most recent sale price */
    lastSalePrice: number;

    /** Date of most recent sale */
    lastSaleDate: Date;

    /** Number of sales used in calculation */
    sampleSize: number;

    /** All verified sales used in calculation */
    verifiedSales: CompSale[];

    /** Timestamp when this data was fetched */
    fetchedAt: Date;

    /** Type of card data - base auto (preferred) or refractor fallback */
    cardType: 'base' | 'refractor';

    /** Inferred 1st Bowman year from sales data */
    inferredYear: number | null;
}

/**
 * Result of a scraping operation
 */
export interface ScrapeResult {
    /** Player being scraped */
    playerName: string;

    /** Whether the scrape was successful */
    success: boolean;

    /** Market data if successful */
    marketData?: CurrentMarketData;

    /** Error details if failed */
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    };

    /** Scraping metadata */
    metadata: {
        totalCompsFound: number;
        compsAfterFiltering: number;
        firstBowmanYear?: number;
        proxyUsed: number;
        responseTime: number;
    };
}

// =============================================================================
// PRICE TRACKING TYPES
// =============================================================================

/**
 * Price delta calculation for a card
 */
export interface PriceDelta {
    /** Player name */
    playerName: string;

    /** Baseline price from article */
    baselinePrice: number;

    /** Article date for the baseline */
    baselineDate: Date;

    /** Current average market price */
    currentPrice: number;

    /** Date of current price data */
    currentDate: Date;

    /** Absolute change in price */
    absoluteChange: number;

    /** Percentage change */
    percentageChange: number;

    /** Direction of price movement */
    direction: 'up' | 'down' | 'stable';

    /** Classification of movement magnitude */
    magnitude: 'significant' | 'moderate' | 'minimal';

    /** Time elapsed since baseline */
    daysElapsed: number;
}

/**
 * Complete tracked card with all price data
 */
export interface TrackedCard {
    /** Unique identifier */
    id: string;

    /** Player name */
    playerName: string;

    /** Normalized name for matching */
    normalizedPlayerName: string;

    /** Player's hobby ranking (1-200) */
    hobbyRanking?: number;

    /** Release year */
    releaseYear: number;

    /** Baseline price data */
    baseline: BaselinePrice;

    /** Current market data (may be stale) */
    currentMarket?: CurrentMarketData;

    /** Calculated price delta */
    priceDelta?: PriceDelta;

    /** When data was last refreshed */
    lastUpdated: Date;

    /** Whether data needs refresh */
    isStale: boolean;
}

// =============================================================================
// DATABASE TYPES
// =============================================================================

/**
 * Database record for a baseline price
 */
export interface BaselinePriceRow {
    id: string;
    player_name: string;
    normalized_player_name: string;
    original_price: number;
    article_date: string;
    article_source: string;
    release_year: number | null;
    notes: string | null;
    created_at: string;
}

/**
 * Database record for current market data
 */
export interface CurrentMarketRow {
    id: string;
    player_name: string;
    normalized_player_name: string;
    average_price: number;
    median_price: number;
    last_sale_price: number;
    last_sale_date: string;
    sample_size: number;
    verified_sales_json: string;
    fetched_at: string;
    card_type: string;
    inferred_year: number | null;
}

/**
 * Database record for a tracked card
 */
export interface TrackedCardRow {
    id: string;
    player_name: string;
    normalized_player_name: string;
    hobby_ranking: number | null;
    release_year: number;
    baseline_id: string;
    current_market_id: string | null;
    last_updated: string;
}

// =============================================================================
// UI TYPES
// =============================================================================

/**
 * Sort options for the dashboard
 */
export type SortOption =
    | 'player-asc'
    | 'player-desc'
    | 'price-asc'
    | 'price-desc'
    | 'delta-asc'
    | 'delta-desc'
    | 'ranking-asc'
    | 'ranking-desc';

/**
 * Filter options for the dashboard
 */
export interface FilterOptions {
    /** Search query for player name */
    searchQuery: string;

    /** Minimum price delta percentage */
    minDelta?: number;

    /** Maximum price delta percentage */
    maxDelta?: number;

    /** Filter by delta direction */
    deltaDirection?: 'up' | 'down' | 'all';

    /** Filter by release year */
    releaseYear?: number;

    /** Only show stale data that needs refresh */
    showStaleOnly: boolean;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
    /** Total cards being tracked */
    totalCards: number;

    /** Cards with positive price movement */
    cardsUp: number;

    /** Cards with negative price movement */
    cardsDown: number;

    /** Cards with stable prices */
    cardsStable: number;

    /** Average price change across all cards */
    averageChange: number;

    /** Biggest gainer */
    topGainer?: {
        playerName: string;
        percentageChange: number;
    };

    /** Biggest loser */
    topLoser?: {
        playerName: string;
        percentageChange: number;
    };

    /** Data freshness */
    lastRefresh: Date;

    /** Number of cards with stale data */
    staleCardCount: number;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Configuration for the collection tool
 */
export interface CollectionConfig {
    /** How often to refresh market data (in hours) */
    refreshIntervalHours: number;

    /** Maximum age of data before considered stale (in hours) */
    staleThresholdHours: number;

    /** Threshold for "significant" price change (percentage) */
    significantChangeThreshold: number;

    /** Threshold for "moderate" price change (percentage) */
    moderateChangeThreshold: number;

    /** Target release year for filtering */
    targetReleaseYear: number;

    /** Maximum comps to consider per player */
    maxCompsPerPlayer: number;

    /** Days of sales history to consider */
    salesHistoryDays: number;
}

/**
 * Default configuration values
 * 
 * Note: maxCompsPerPlayer is set to 5 to focus on the most recent sales
 * for accurate, current market pricing.
 */
export const DEFAULT_COLLECTION_CONFIG: CollectionConfig = {
    refreshIntervalHours: 24,
    staleThresholdHours: 48,
    significantChangeThreshold: 20,
    moderateChangeThreshold: 10,
    targetReleaseYear: 2025,
    maxCompsPerPlayer: 5,  // Focus on 5 most recent base auto sales
    salesHistoryDays: 90,
};
