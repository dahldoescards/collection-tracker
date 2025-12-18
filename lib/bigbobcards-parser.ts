/**
 * =============================================================================
 * BIGBOBCARDS ARTICLE PARSER
 * =============================================================================
 * 
 * Sophisticated parser for extracting baseline price data from BigBobCards
 * articles. Handles various article formats and normalizes player/price data.
 * 
 * Article Format Examples:
 * - "Player Name - $XX.XX (notes)"
 * - "Player Name: $XX.XX average"
 * - "$XX - $YY range for Player Name"
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import {
    BaselinePrice,
    RawArticle,
    ArticleParseResult,
    ParseError,
} from './collection-types';
import { PLAYER_RANKINGS, TOP_200_PLAYERS } from './types';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Regular expressions for parsing price patterns
 * These patterns handle various formats found in BigBobCards articles
 */
const PRICE_PATTERNS = {
    // Standard format: $XX.XX
    standard: /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,

    // Range format: $XX - $YY
    range: /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[-–—]\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,

    // Circa format: ~$XX or roughly $XX
    approximate: /(?:~|approximately|about|roughly|circa)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,

    // Average format: $XX average
    average: /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:average|avg)/i,
};

/**
 * Date format patterns for article date parsing
 */
const DATE_PATTERNS = [
    // "January 15, 2024" or "Jan 15, 2024"
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,

    // "15 January 2024"
    /(\d{1,2})\s+(\w+)\s+(\d{4})/,

    // "2024-01-15" (ISO format)
    /(\d{4})-(\d{2})-(\d{2})/,

    // "01/15/2024" or "1/15/2024"
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
];

/**
 * Month name to number mapping
 */
const MONTH_MAP: Record<string, number> = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11,
};

/**
 * Words that indicate non-player content (section headers, etc.)
 */
const EXCLUDED_CONTENT = [
    'advertisement',
    'sponsored',
    'click here',
    'subscribe',
    'newsletter',
    'total value',
    'sum total',
    'grand total',
    'check out',
    'related posts',
    'comments',
    'share this',
];

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

/**
 * Logger with namespace prefix for Collection Parser
 */
const log = {
    info: (msg: string, ...args: unknown[]) => console.log(`[BigBobCards Parser] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[BigBobCards Parser] ⚠️ ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[BigBobCards Parser] ❌ ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[BigBobCards Parser] 🐛 ${msg}`, ...args);
        }
    },
};

// =============================================================================
// PARSING FUNCTIONS
// =============================================================================

/**
 * Normalize player name for matching against the Top 200 list
 * Handles various name formats and common variations
 * 
 * @param name - Raw player name from article
 * @returns Normalized name for matching
 */
export function normalizePlayerName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        // Remove common suffixes
        .replace(/\s+jr\.?$/i, '')
        .replace(/\s+sr\.?$/i, '')
        .replace(/\s+iii?$/i, '')
        .replace(/\s+iv$/i, '')
        // Normalize spaces
        .replace(/\s+/g, ' ')
        // Remove special characters but keep hyphens and apostrophes
        .replace(/[^\w\s\-']/g, '')
        // Normalize common name variations
        .replace(/\bmike\b/g, 'michael')
        .replace(/\bjimmy\b/g, 'james')
        .replace(/\bbobby\b/g, 'robert')
        .replace(/\bdanny\b/g, 'daniel');
}

/**
 * Find a player name in text by matching against Top 200 list
 * Uses fuzzy matching to handle variations
 * 
 * @param text - Text to search for player names
 * @returns Matched player info or null
 */
export function findPlayerInText(text: string): {
    name: string;
    normalizedName: string;
    ranking: number;
    matchStart: number;
    matchEnd: number;
} | null {
    const normalizedText = text.toLowerCase();

    // Try exact matches first (more efficient)
    for (const player of TOP_200_PLAYERS) {
        const idx = normalizedText.indexOf(player);
        if (idx !== -1) {
            const ranking = PLAYER_RANKINGS.get(player) || 999;
            return {
                name: player,
                normalizedName: player,
                ranking,
                matchStart: idx,
                matchEnd: idx + player.length,
            };
        }
    }

    // Try partial matches (first + last name)
    for (const player of TOP_200_PLAYERS) {
        const [firstName, ...lastParts] = player.split(' ');
        const lastName = lastParts.join(' ');

        if (firstName && lastName) {
            // Check if both first and last name appear in text
            const firstIdx = normalizedText.indexOf(firstName);
            const lastIdx = normalizedText.indexOf(lastName);

            if (firstIdx !== -1 && lastIdx !== -1) {
                const ranking = PLAYER_RANKINGS.get(player) || 999;
                return {
                    name: player,
                    normalizedName: player,
                    ranking,
                    matchStart: Math.min(firstIdx, lastIdx),
                    matchEnd: Math.max(firstIdx + firstName.length, lastIdx + lastName.length),
                };
            }
        }
    }

    return null;
}

/**
 * Extract price value from text
 * Handles various formats: $XX, $X,XXX, $XX.XX, ranges, averages
 * 
 * @param text - Text containing price information
 * @returns Extracted price or null
 */
export function extractPrice(text: string): number | null {
    // Try average format first (most specific)
    const avgMatch = text.match(PRICE_PATTERNS.average);
    if (avgMatch) {
        return parseFloat(avgMatch[1].replace(/,/g, ''));
    }

    // Try range format (take midpoint)
    const rangeMatch = text.match(PRICE_PATTERNS.range);
    if (rangeMatch) {
        const low = parseFloat(rangeMatch[1].replace(/,/g, ''));
        const high = parseFloat(rangeMatch[2].replace(/,/g, ''));
        return (low + high) / 2; // Use midpoint of range
    }

    // Try approximate format
    const approxMatch = text.match(PRICE_PATTERNS.approximate);
    if (approxMatch) {
        return parseFloat(approxMatch[1].replace(/,/g, ''));
    }

    // Try standard format (take first match)
    const standardMatches = text.match(PRICE_PATTERNS.standard);
    if (standardMatches && standardMatches.length > 0) {
        // Extract just the number from the first match
        const priceMatch = standardMatches[0].match(/\d+(?:,\d{3})*(?:\.\d{2})?/);
        if (priceMatch) {
            return parseFloat(priceMatch[0].replace(/,/g, ''));
        }
    }

    return null;
}

/**
 * Parse article date from date string
 * Supports multiple date formats commonly found in articles
 * 
 * @param dateString - Date string from article
 * @returns Parsed Date object or current date if parsing fails
 */
export function parseArticleDate(dateString: string): Date {
    // Try ISO format first
    const isoMatch = dateString.match(DATE_PATTERNS[2]);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Try US format (MM/DD/YYYY)
    const usMatch = dateString.match(DATE_PATTERNS[3]);
    if (usMatch) {
        const [, month, day, year] = usMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Try "Month DD, YYYY" format
    const monthFirstMatch = dateString.match(DATE_PATTERNS[0]);
    if (monthFirstMatch) {
        const [, monthName, day, year] = monthFirstMatch;
        const month = MONTH_MAP[monthName.toLowerCase()];
        if (month !== undefined) {
            return new Date(parseInt(year), month, parseInt(day));
        }
    }

    // Try "DD Month YYYY" format
    const dayFirstMatch = dateString.match(DATE_PATTERNS[1]);
    if (dayFirstMatch) {
        const [, day, monthName, year] = dayFirstMatch;
        const month = MONTH_MAP[monthName.toLowerCase()];
        if (month !== undefined) {
            return new Date(parseInt(year), month, parseInt(day));
        }
    }

    // Fallback to current date with warning
    log.warn(`Could not parse date: "${dateString}", using current date`);
    return new Date();
}

/**
 * Check if a line should be excluded from parsing
 * Filters out headers, footers, ads, and other non-price content
 * 
 * @param line - Line of text to check
 * @returns true if line should be excluded
 */
function shouldExcludeLine(line: string): boolean {
    const lowerLine = line.toLowerCase();

    // Check for excluded content
    for (const excluded of EXCLUDED_CONTENT) {
        if (lowerLine.includes(excluded)) {
            return true;
        }
    }

    // Skip lines that are too short (likely section breaks)
    if (line.trim().length < 10) {
        return true;
    }

    // Skip lines that don't contain a price
    if (!line.includes('$') && !line.match(/\d+\.\d{2}/)) {
        return true;
    }

    return false;
}

/**
 * Parse a single line from an article to extract player and price
 * 
 * @param line - Single line of text
 * @param lineNumber - Line number for error reporting
 * @param articleDate - Date of the article
 * @param articleSource - Source identifier
 * @returns Parsed baseline price or null
 */
function parseLine(
    line: string,
    lineNumber: number,
    articleDate: Date,
    articleSource: string
): { price: BaselinePrice | null; error: ParseError | null } {
    // Skip excluded lines
    if (shouldExcludeLine(line)) {
        return { price: null, error: null };
    }

    // Find player in line
    const playerMatch = findPlayerInText(line);
    if (!playerMatch) {
        return {
            price: null,
            error: {
                line,
                lineNumber,
                reason: 'No matching player found from Top 200 list',
            },
        };
    }

    // Extract price
    const price = extractPrice(line);
    if (price === null) {
        return {
            price: null,
            error: {
                line,
                lineNumber,
                reason: 'Could not extract price value',
            },
        };
    }

    // Validate price is reasonable (basic sanity check)
    if (price < 0 || price > 100000) {
        return {
            price: null,
            error: {
                line,
                lineNumber,
                reason: `Price out of reasonable range: $${price}`,
            },
        };
    }

    // Create baseline price record
    const baselinePrice: BaselinePrice = {
        id: uuidv4(),
        playerName: playerMatch.name,
        normalizedPlayerName: playerMatch.normalizedName,
        originalPrice: price,
        articleDate,
        articleSource,
        createdAt: new Date(),
    };

    log.debug(`Parsed: ${playerMatch.name} @ $${price}`);

    return { price: baselinePrice, error: null };
}

// =============================================================================
// MAIN PARSER FUNCTION
// =============================================================================

/**
 * Parse a BigBobCards article to extract baseline price data
 * 
 * This function performs comprehensive parsing of article content,
 * extracting player names (matched against Top 200 list) and their
 * associated prices.
 * 
 * @param article - Raw article data to parse
 * @returns Parsing result with extracted prices and any errors
 * 
 * @example
 * ```typescript
 * const result = parseArticle({
 *   content: "Konnor Griffin's base auto is selling for $45-55...",
 *   dateString: "December 15, 2024",
 *   source: "bigbobcards-december-2024"
 * });
 * 
 * console.log(result.prices); // [{ playerName: "konnor griffin", originalPrice: 50, ... }]
 * ```
 */
export function parseArticle(article: RawArticle): ArticleParseResult {
    log.info(`Parsing article from source: ${article.source}`);

    // Parse article date
    const articleDate = parseArticleDate(article.dateString);
    log.info(`Article date: ${articleDate.toLocaleDateString()}`);

    // Split content into lines
    const lines = article.content
        .split(/[\r\n]+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    log.info(`Processing ${lines.length} lines`);

    // Track results
    const prices: BaselinePrice[] = [];
    const unparsedLines: string[] = [];
    const errors: ParseError[] = [];
    const seenPlayers = new Set<string>();

    // Process each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        const result = parseLine(line, lineNumber, articleDate, article.source);

        if (result.price) {
            // Check for duplicates (take first occurrence)
            if (!seenPlayers.has(result.price.normalizedPlayerName)) {
                prices.push(result.price);
                seenPlayers.add(result.price.normalizedPlayerName);
            } else {
                log.debug(`Duplicate player skipped: ${result.price.playerName}`);
            }
        } else if (result.error) {
            errors.push(result.error);
            unparsedLines.push(line);
        }
    }

    // Calculate metadata
    const totalLines = lines.length;
    const successfullyParsed = prices.length;
    const parseRate = totalLines > 0 ? successfullyParsed / totalLines : 0;

    log.info(`Parsing complete: ${successfullyParsed}/${totalLines} lines (${(parseRate * 100).toFixed(1)}% success rate)`);

    if (errors.length > 0) {
        log.warn(`${errors.length} lines could not be parsed`);
    }

    return {
        prices,
        unparsedLines,
        errors,
        metadata: {
            totalLines,
            successfullyParsed,
            parseRate,
            articleDate,
        },
    };
}

/**
 * Parse multiple articles and combine results
 * Handles overlapping player data by keeping the most recent
 * 
 * @param articles - Array of raw articles to parse
 * @returns Combined parsing results
 */
export function parseMultipleArticles(articles: RawArticle[]): ArticleParseResult {
    log.info(`Parsing ${articles.length} articles`);

    const allPrices: Map<string, BaselinePrice> = new Map();
    const allUnparsedLines: string[] = [];
    const allErrors: ParseError[] = [];
    let totalLines = 0;
    let latestDate = new Date(0);

    // Sort articles by date (oldest first) so newer prices overwrite older
    const sortedArticles = [...articles].sort((a, b) => {
        const dateA = parseArticleDate(a.dateString);
        const dateB = parseArticleDate(b.dateString);
        return dateA.getTime() - dateB.getTime();
    });

    for (const article of sortedArticles) {
        const result = parseArticle(article);

        // Update latest date
        if (result.metadata.articleDate > latestDate) {
            latestDate = result.metadata.articleDate;
        }

        // Merge prices (newer overwrites older)
        for (const price of result.prices) {
            allPrices.set(price.normalizedPlayerName, price);
        }

        // Collect all unparsed lines and errors
        allUnparsedLines.push(...result.unparsedLines);
        allErrors.push(...result.errors);
        totalLines += result.metadata.totalLines;
    }

    const prices = Array.from(allPrices.values());
    const successfullyParsed = prices.length;
    const parseRate = totalLines > 0 ? successfullyParsed / totalLines : 0;

    log.info(`Combined parsing: ${successfullyParsed} unique players from ${articles.length} articles`);

    return {
        prices,
        unparsedLines: allUnparsedLines,
        errors: allErrors,
        metadata: {
            totalLines,
            successfullyParsed,
            parseRate,
            articleDate: latestDate,
        },
    };
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export {
    PRICE_PATTERNS,
    DATE_PATTERNS,
    MONTH_MAP,
    EXCLUDED_CONTENT,
};
