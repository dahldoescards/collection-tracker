/**
 * =============================================================================
 * SEED AL WEST EARLY DEBUTS - December 22, 2025
 * =============================================================================
 * 
 * Script to seed prospect data from BigBobCards December 22nd article.
 * AL West prospects predicted to make early MLB debuts in 2026.
 * 
 * Run with: npx tsx scripts/seed-dec22-al-west.ts
 * 
 * @author Collection Tool
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import {
    initializeDatabase,
    bulkInsertBaselinePrices,
    closeDatabase,
} from '../lib/collection-database';
import { BaselinePrice } from '../lib/collection-types';

// =============================================================================
// ARTICLE DATA - December 22, 2025 AL West Early Debuts
// =============================================================================

interface PlayerData {
    playerName: string;
    team: string;
    price: number;
    articleDate: string;
    notes: string;
    releaseYear?: number; // Override release year (default 2025)
}

// 12/22/25 - AL West Early Debuts
const AL_WEST_DEC_22: PlayerData[] = [
    {
        playerName: 'Ethan Pecko',
        team: 'HOU',
        price: 5,
        articleDate: '2025-12-22',
        notes: 'Underrated RHP. 5-pitch mix, FB sits mid-90s with carry. 3.83 ERA, 3.29 FIP, 10.69 K/9 in AA/AAA. AAA: 3.09 ERA, 12.34 K/9. Top 50 pitching prospect. Deep mix, good control, should debut this season.',
    },
    {
        playerName: 'George Klassen',
        team: 'LAA',
        price: 12,
        articleDate: '2025-12-22',
        notes: 'High octane stuff - FB touches triple digits, sits 97-98. Filthy curve and slider - three 60+ grade pitches. 3.21 FIP despite 5.22 ERA. Command improving: BB% from 12% to 9.7%. Final AAA start: 6 IP, 2 H, 1 BB, 8 K.',
    },
    {
        playerName: 'Josh Kuroda-Grauer',
        team: 'OAK',
        price: 8,
        articleDate: '2025-12-22',
        notes: 'Speedy MIF, allergic to strikeouts. K rates of 7.1% and 8.9%. Contact rates of 90.3% and 87.4%. Hit .296 with 27 SB. AFL: .345 in 18 games. Semien comp from org. As guaranteed to make MLB as anyone under $10.',
    },
    {
        playerName: 'Colt Emerson',
        team: 'SEA',
        price: 140,
        articleDate: '2025-12-22',
        releaseYear: 2023, // 2023 Bowman Chrome
        notes: 'TOP 10 PROSPECT. Very short print auto - only 1 raw sale in 3 months. Expected to compete for OD roster. .285/16 HR/14 SB across A+/AA/AAA. 17.5% K rate, 82.2% contact. Only prospect age 20 or under to reach AAA with .170+ ISO and <9% SwStr%.',
    },
    {
        playerName: 'Abimelec Ortiz',
        team: 'TEX',
        price: 9,
        articleDate: '2025-12-22',
        notes: 'Power bat - 25 HR with elite contact. 91st percentile Max EV, 93rd Hard Hit% in AAA. 78.8% contact, 88.6% IZ contact. Only player with 25+ HR and 75%+ contact rate. 1B/DH destination - Rangers weakest positions.',
    },
];

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
    console.log('🌱 Seeding December 22nd AL West Early Debut article...\n');
    console.log('📅 Article: 12/22/2025');
    console.log(`📊 Total players: ${AL_WEST_DEC_22.length}\n`);

    // Initialize database
    initializeDatabase();

    // Create baseline price records
    const prices: BaselinePrice[] = AL_WEST_DEC_22.map(data => ({
        id: uuidv4(),
        playerName: data.playerName,
        normalizedPlayerName: data.playerName.toLowerCase(),
        originalPrice: data.price,
        articleDate: new Date(data.articleDate),
        articleSource: `bigbobcards-early-debut-${data.articleDate}`,
        releaseYear: data.releaseYear || 2025, // Use player-specific or default to 2025
        notes: `${data.team} - ${data.notes}`,
        createdAt: new Date(),
    }));

    // Log players
    console.log('📋 Players:\n');
    console.log('--- 12/22/25 - AL West ---');
    for (const p of AL_WEST_DEC_22) {
        console.log(`  ${p.playerName.padEnd(24)} ${p.team}  $${p.price.toFixed(2).padStart(6)}`);
    }

    console.log('\n' + '─'.repeat(50));
    console.log(`  Total: ${AL_WEST_DEC_22.length} prospects`);
    console.log('─'.repeat(50));

    // Insert into database
    const count = bulkInsertBaselinePrices(prices);

    console.log(`\n✅ Successfully seeded ${count} AL West early debut candidates!\n`);

    // Close database
    closeDatabase();

    console.log('💡 Next steps:');
    console.log('   1. View dashboard at http://localhost:3001');
    console.log('   2. Click "Refresh All" to fetch current prices');
    console.log('   3. New total should be 76 cards (71 + 5)\n');
}

main().catch(err => {
    console.error('❌ Error seeding data:', err);
    process.exit(1);
});
