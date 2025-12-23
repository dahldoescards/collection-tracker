/**
 * =============================================================================
 * CLEANUP COMPS - Remove Invalid Sales from Database
 * =============================================================================
 * 
 * Script to clean up existing sales data by applying exclusion filters.
 * Run with: npx tsx scripts/cleanup-comps.ts
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

const Database = require('better-sqlite3');
const path = require('path');

// =============================================================================
// EXCLUSION PATTERNS (copied from unified-scraper.ts)
// =============================================================================

// Graded card indicators
const GRADED_INDICATORS = [
    'psa', 'bgs', 'sgc', 'cgc', 'hga', 'csg',
    'beckett',
    'gem mint', 'gem mt 10', 'mint 9', 'perfect 10', 'pristine',
];

// Lot indicators
const LOT_INDICATORS = [
    '(2)', '(3)', '(4)', '(5)', '(6)', '(10)', '(20)',
    '[2]', '[3]', '[4]', '[5]', '[6]', '[10]', '[20]',
    'lot', 'bundle', 'set of', 'collection of', 'group',
    '& ', ' and ', ' + ',
];

// Lot quantity regex patterns
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

// Excluded products
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

// IP autograph indicators
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

// OBO/unclear pricing indicators
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
    const lowerTitle = ` ${title.toLowerCase()} `;  // Pad with spaces for word boundary matching

    // Check graded
    for (const indicator of GRADED_INDICATORS) {
        if (lowerTitle.includes(indicator)) {
            return { exclude: true, reason: `Graded: ${indicator}` };
        }
    }

    // Check lots
    for (const indicator of LOT_INDICATORS) {
        if (lowerTitle.includes(indicator)) {
            return { exclude: true, reason: `Lot: ${indicator}` };
        }
    }

    // Check lot patterns
    for (const pattern of LOT_QUANTITY_PATTERNS) {
        if (pattern.test(title)) {
            return { exclude: true, reason: `Lot pattern` };
        }
    }

    // Check excluded products
    for (const product of EXCLUDED_PRODUCTS) {
        if (lowerTitle.includes(product)) {
            return { exclude: true, reason: `Wrong product: ${product}` };
        }
    }

    // Check IP autos
    for (const indicator of IP_AUTOGRAPH_INDICATORS) {
        if (lowerTitle.includes(indicator)) {
            return { exclude: true, reason: `IP auto: ${indicator.trim()}` };
        }
    }

    // Check OBO/unclear pricing
    for (const indicator of UNCLEAR_PRICING_INDICATORS) {
        if (lowerTitle.includes(indicator)) {
            return { exclude: true, reason: `Unclear pricing: ${indicator.trim()}` };
        }
    }

    return { exclude: false, reason: '' };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'collection_data.db');
    console.log(`🔍 Cleaning up comps in: ${dbPath}\n`);

    const db = new Database(dbPath);

    // Get all sales
    const sales = db.prepare('SELECT id, title, normalized_player_name FROM individual_sales').all() as SaleRow[];
    console.log(`📊 Found ${sales.length} total sales to check\n`);

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

    console.log(`🗑️  Found ${toDelete.length} invalid sales to remove:\n`);

    // Group by reason
    const byReason: Record<string, number> = {};
    for (const sale of toDelete) {
        const key = sale.reason.split(':')[0];
        byReason[key] = (byReason[key] || 0) + 1;
    }

    console.log('📋 Breakdown by reason:');
    for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${reason.padEnd(20)} ${count}`);
    }
    console.log('');

    // Show sample of what will be deleted
    console.log('📝 Sample of sales to delete (first 20):');
    for (const sale of toDelete.slice(0, 20)) {
        console.log(`   [${sale.player}] ${sale.reason}`);
        console.log(`      "${sale.title.substring(0, 80)}..."`);
    }

    if (toDelete.length > 20) {
        console.log(`   ... and ${toDelete.length - 20} more\n`);
    }

    // Actually delete
    console.log('\n🗑️  Deleting invalid sales...');
    const deleteStmt = db.prepare('DELETE FROM individual_sales WHERE id = ?');

    const deleteMany = db.transaction((ids: string[]) => {
        for (const id of ids) {
            deleteStmt.run(id);
        }
    });

    deleteMany(toDelete.map(s => s.id));

    console.log(`✅ Deleted ${toDelete.length} invalid sales\n`);

    // Show remaining count
    const remaining = db.prepare('SELECT COUNT(*) as count FROM individual_sales').get() as { count: number };
    console.log(`📊 Remaining valid sales: ${remaining.count}\n`);

    db.close();
    console.log('✅ Cleanup complete!');
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
