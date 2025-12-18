/**
 * =============================================================================
 * PARSE API ROUTE - Article Parsing Endpoint
 * =============================================================================
 * 
 * API route for parsing BigBobCards articles and storing baseline prices.
 * 
 * Endpoints:
 * - POST /api/collection/parse - Parse article content
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';

import {
    initializeDatabase,
    bulkInsertBaselinePrices,
} from '@/lib/collection-database';
import {
    parseArticle,
    parseMultipleArticles,
} from '@/lib/bigbobcards-parser';
import {
    RawArticle,
    ArticleParseResult,
} from '@/lib/collection-types';

// =============================================================================
// TYPES
// =============================================================================

interface ParseRequest {
    /** Single article to parse */
    article?: RawArticle;

    /** Multiple articles to parse */
    articles?: RawArticle[];

    /** Whether to save parsed results to database */
    save?: boolean;
}

interface ParseResponse {
    success: boolean;
    result?: ArticleParseResult;
    saved?: number;
    error?: {
        code: string;
        message: string;
    };
}

// =============================================================================
// POST HANDLER - Parse Articles
// =============================================================================

export async function POST(request: NextRequest) {
    console.log('[Parse API] POST /api/collection/parse');

    try {
        // Parse request body
        const body = await request.json() as ParseRequest;

        // Validate request
        if (!body.article && !body.articles?.length) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Must provide article or articles array',
                },
            }, { status: 400 });
        }

        // Parse articles
        let result: ArticleParseResult;

        if (body.articles?.length) {
            console.log(`[Parse API] Parsing ${body.articles.length} articles`);
            result = parseMultipleArticles(body.articles);
        } else {
            console.log(`[Parse API] Parsing single article from: ${body.article!.source}`);
            result = parseArticle(body.article!);
        }

        console.log(`[Parse API] Parsed ${result.prices.length} prices`);

        // Save to database if requested
        let saved = 0;
        if (body.save !== false && result.prices.length > 0) {
            initializeDatabase();
            saved = bulkInsertBaselinePrices(result.prices);
            console.log(`[Parse API] Saved ${saved} baseline prices`);
        }

        const response: ParseResponse = {
            success: true,
            result,
            saved: body.save !== false ? saved : undefined,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('[Parse API] Error:', error);

        const response: ParseResponse = {
            success: false,
            error: {
                code: 'PARSE_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error occurred',
            },
        };

        return NextResponse.json(response, { status: 500 });
    }
}
