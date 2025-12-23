/**
 * =============================================================================
 * CLEANUP API - Remove Invalid Sales from Database
 * =============================================================================
 * 
 * API route to clean up invalid sales using exclusion filters.
 * Requires admin authentication via bearer token (CRON_SECRET).
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

// =============================================================================
// EXCLUSION PATTERNS
// =============================================================================

const GRADED_INDICATORS = [
    'psa', 'bgs', 'sgc', 'cgc', 'hga', 'csg',
    'beckett',
    'gem mint', 'gem mt 10', 'mint 9', 'perfect 10', 'pristine',
];

const LOT_INDICATORS = [
    '(2)', '(3)', '(4)', '(5)', '(6)', '(10)', '(20)',
    '[2]', '[3]', '[4]', '[5]', '[6]', '[10]', '[20]',
    'lot', 'bundle', 'set of', 'collection of', 'group',
    '& ', ' and ', ' + ',
];

const LOT_QUANTITY_PATTERNS = [
    /\(x\d+\)/i,
    /\[x\d+\]/i,
    /\(\d+x\)/i,
    /\[\d+x\]/i,
    /\bx\d+\b/i,
    /\(\d+\s*cards?\)/i,
    /\[\d+\s*cards?\]/i,
    /\b[2-9]\s*cards?\b/i,
    /\b\d{2,}\s*cards?\b/i,
];

const EXCLUDED_PRODUCTS = [
    'topps chrome', 'panini', 'donruss', 'prizm', 'contenders',
    'leaf', 'sterling', 'heritage', 'finest',
    'arizona fall league', 'fall league', 'aflac',
    'redemption', 'vip', 'relic', 'patch',
    'bunt', 'digital', 'nft', 'virtual',
    'bowman u', 'bowman university',
    'mega',
    'class of',
];

const IP_AUTOGRAPH_INDICATORS = [
    ' ip ',
    ' ip auto',
    'in person',
    'in-person',
    'signed in',
    'signed at',
    'signed by',
    'signed card',
    ' signed ',
    'hand signed',
    'hand-signed',
    'authentic auto',
    'convention',
    'meet and greet',
    'autograph event',
    'signing event',
];

const UNCLEAR_PRICING_INDICATORS = [
    ' obo',
    ' obo ',
    'or best offer',
    'best offer accepted',
];

// =============================================================================
// CHECK FUNCTION
// =============================================================================

interface SaleRow {
    id: string;
    title: string;
    normalized_player_name: string;
}

function shouldExclude(title: string): { exclude: boolean; reason: string } {
    const lowerTitle = ` ${title.toLowerCase()} `;

    for (const indicator of GRADED_INDICATORS) {
        if (lowerTitle.includes(indicator)) {
            return { exclude: true, reason: `Graded: ${indicator}` };
        }
    }

    for (const indicator of LOT_INDICATORS) {
        if (lowerTitle.includes(indicator)) {
            return { exclude: true, reason: `Lot: ${indicator}` };
        }
    }

    for (const pattern of LOT_QUANTITY_PATTERNS) {
        if (pattern.test(title)) {
            return { exclude: true, reason: `Lot pattern` };
        }
    }

    for (const product of EXCLUDED_PRODUCTS) {
        if (lowerTitle.includes(product)) {
            return { exclude: true, reason: `Wrong product: ${product}` };
        }
    }

    for (const indicator of IP_AUTOGRAPH_INDICATORS) {
        if (lowerTitle.includes(indicator)) {
            return { exclude: true, reason: `IP auto: ${indicator.trim()}` };
        }
    }

    for (const indicator of UNCLEAR_PRICING_INDICATORS) {
        if (lowerTitle.includes(indicator)) {
            return { exclude: true, reason: `Unclear pricing: ${indicator.trim()}` };
        }
    }

    return { exclude: false, reason: '' };
}

// =============================================================================
// POST HANDLER
// =============================================================================

interface CleanupResponse {
    success: boolean;
    deleted?: number;
    remaining?: number;
    breakdown?: Record<string, number>;
    samples?: { player: string; reason: string; title: string }[];
    error?: {
        code: string;
        message: string;
    };
}

export async function POST(request: NextRequest) {
    console.log('[Cleanup API] POST /api/collection/cleanup');

    // Check for admin auth
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token !== process.env.CRON_SECRET) {
        return NextResponse.json<CleanupResponse>({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or missing authorization token',
            },
        }, { status: 401 });
    }

    try {
        const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'collection_data.db');
        const db = new Database(dbPath);

        // Get all sales
        const sales = db.prepare('SELECT id, title, normalized_player_name FROM individual_sales').all() as SaleRow[];
        console.log(`[Cleanup API] Found ${sales.length} total sales to check`);

        const toDelete: { id: string; title: string; player: string; reason: string }[] = [];

        for (const sale of sales) {
            const result = shouldExclude(sale.title);
            if (result.exclude) {
                toDelete.push({
                    id: sale.id,
                    title: sale.title,
                    player: sale.normalized_player_name,
                    reason: result.reason,
                });
            }
        }

        // Group by reason
        const breakdown: Record<string, number> = {};
        for (const sale of toDelete) {
            const key = sale.reason.split(':')[0].trim();
            breakdown[key] = (breakdown[key] || 0) + 1;
        }

        // Get samples
        const samples = toDelete.slice(0, 10).map(s => ({
            player: s.player,
            reason: s.reason,
            title: s.title.substring(0, 80),
        }));

        // Delete
        if (toDelete.length > 0) {
            const deleteStmt = db.prepare('DELETE FROM individual_sales WHERE id = ?');
            const deleteMany = db.transaction((ids: string[]) => {
                for (const id of ids) {
                    deleteStmt.run(id);
                }
            });
            deleteMany(toDelete.map(s => s.id));
        }

        // Get remaining count
        const remaining = db.prepare('SELECT COUNT(*) as count FROM individual_sales').get() as { count: number };

        db.close();

        console.log(`[Cleanup API] Deleted ${toDelete.length} invalid sales, ${remaining.count} remaining`);

        return NextResponse.json<CleanupResponse>({
            success: true,
            deleted: toDelete.length,
            remaining: remaining.count,
            breakdown,
            samples,
        });

    } catch (error) {
        console.error('[Cleanup API] Error:', error);

        return NextResponse.json<CleanupResponse>({
            success: false,
            error: {
                code: 'CLEANUP_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error occurred',
            },
        }, { status: 500 });
    }
}
