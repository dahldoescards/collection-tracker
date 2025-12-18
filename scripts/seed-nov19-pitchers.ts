/**
 * =============================================================================
 * SEED PITCHERS DATA - November 19, 2025
 * =============================================================================
 * 
 * Script to seed pitcher baseline prices from BigBobCards article.
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-nov19-pitchers.ts
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
// BIGBOBCARDS ARTICLE DATA - November 19, 2025
// =============================================================================

/**
 * Article: "Buy Low Candidates - Pitchers"
 * Source: BigBobCards
 * Date: November 19, 2025
 * 
 * Focus: Pitchers with electric stuff, improving command, and buy-low opportunities
 */
const ARTICLE_DATE = new Date('2025-11-19');
const ARTICLE_SOURCE = 'bigbobcards-pitchers-2025-11-19';

const BASELINE_DATA: Array<{
    playerName: string;
    team: string;
    rank: number;
    price: number;
    notes: string;
}> = [
        // Main featured pitchers
        {
            playerName: 'George Klassen',
            team: 'LAA',
            rank: 39,
            price: 7,
            notes: 'High-90s FB touching triple digits, nasty curveball, high-80s/low-90s slider. 3.21 FIP/3.20 xFIP vs 5.22 ERA suggests extreme bad luck. Walk rate improving yearly. MLB debut likely 2026.',
        },
        {
            playerName: 'Ethan Pecko',
            team: 'HOU',
            rank: 47,
            price: 3,
            notes: 'Rose from unknown to top 50 pitching prospects. 3.83 ERA, 10.69 K/9, 3.04 BB/9 in AA/AAA. 3.29 FIP. Mid-90s FB with carry, nasty slider/sweeper. MLB debut likely 2026.',
        },
        {
            playerName: 'Yoniel Curet',
            team: 'TB',
            rank: 51,
            price: 3,
            notes: 'Most strikeouts in MiLB 2023-2024 combined (303). Plus fastball, above avg slider, emerging changeup. Walk rate dropped from 16.9% to 11.9%. Electric stuff, reliever risk but Rays giving starter chances.',
        },
        {
            playerName: 'Daniel Eagen',
            team: 'ARI',
            rank: 53,
            price: 9,
            notes: 'Big South Pitcher of Year. 2.49 ERA, 12.16 K/9, 3.78 BB/9 in High-A. 6\'4" righty, mid-90s FB, devastating over-the-top curveball. Low mileage on arm, massive ceiling.',
        },
        {
            playerName: 'Adam Serwinowski',
            team: 'LAD',
            rank: 56,
            price: 8,
            notes: '6\'5" lefty traded to Dodgers. FB touches 100+ with movement, filthy slider. Control improving yearly. ERA dropped from 4.84 to 1.83 after trade. Still just 21.',
        },
        {
            playerName: 'Braylon Doughty',
            team: 'CLE',
            rank: 59,
            price: 10,
            notes: 'Former position player, athlete on mound. 95+ FB, plus curveball & slider (3000+ rpm). Elite command for age. Only teenager with K/9>10 and BB/9<2.5 in 20+ starts since Andrew Painter.',
        },
        {
            playerName: 'Winston Santos',
            team: 'TEX',
            rank: 73,
            price: 5,
            notes: 'Buy low - missed 2025 with back stress reaction. 2024: 2.80 ERA, 2.67 FIP, 11.33 K/9 in High-A. 98 max FB with cut, above avg slider. First call-up candidate for Rangers 2026.',
        },
        {
            playerName: 'Charlee Soto',
            team: 'MIN',
            rank: 76,
            price: 7,
            notes: '34th overall pick 2023. Missed time with injuries but stuff is elite. 10.58 K/9 as teenager. FB reported 95-96 at 70-80% effort. 4-pitch mix all with above avg potential. High ceiling.',
        },
        {
            playerName: 'Tanner McDougal',
            team: 'CHW',
            rank: 85,
            price: 7,
            notes: 'Massive breakout 2025: ERA dropped from 6.04 to 3.26. BB/9 improved from 5.65 to 3.89. 6\'5" righty, FB touches triple digits, wipeout curveball. K-BB% up from 13.6% to 18.1%.',
        },
        {
            playerName: 'Kevin Defrank',
            team: 'MIA',
            rank: 88,
            price: 9,
            notes: 'DSL standout at age 16 - extremely rare buy. 6\'5" athlete, already touched 100 mph. Advanced changeup, good slider. Marlins elite at developing pitching. Highest ceiling on list.',
        },

        // Sleepers
        {
            playerName: 'Boston Bateman',
            team: 'BAL',
            rank: 111,
            price: 8,
            notes: 'Sleeper pick - Orioles system.',
        },
        {
            playerName: 'Anderson Brito',
            team: 'HOU',
            rank: 115,
            price: 5,
            notes: 'Sleeper pick - Astros system.',
        },
        {
            playerName: 'Bryce Meccage',
            team: 'MIL',
            rank: 121,
            price: 5,
            notes: 'Sleeper pick - Brewers system.',
        },
        {
            playerName: 'Miguel Ullola',
            team: 'HOU',
            rank: 122,
            price: 5,
            notes: 'Sleeper pick - Astros system.',
        },
        {
            playerName: 'Chase Hampton',
            team: 'NYY',
            rank: 125,
            price: 6,
            notes: 'Sleeper pick - Yankees system.',
        },
        {
            playerName: 'Yordanny Monegro',
            team: 'BOS',
            rank: 131,
            price: 7,
            notes: 'Sleeper pick - Red Sox system.',
        },
        {
            playerName: 'Tyson Neighbors',
            team: 'BAL',
            rank: 134,
            price: 5,
            notes: 'Sleeper pick - Orioles system.',
        },
        {
            playerName: 'Trevor Harrison',
            team: 'TB',
            rank: 137,
            price: 6,
            notes: 'Sleeper pick - Rays system.',
        },
        {
            playerName: 'Henry Baez',
            team: 'ATH',
            rank: 175,
            price: 3,
            notes: 'Sleeper pick - Athletics system.',
        },
        {
            playerName: 'Zach Thornton',
            team: 'NYM',
            rank: 182,
            price: 9,
            notes: 'Sleeper pick - Mets system.',
        },
        {
            playerName: 'Brody Brecht',
            team: 'COL',
            rank: 183,
            price: 8,
            notes: 'Sleeper pick - Rockies system.',
        },
        {
            playerName: 'Gary Gill Hill',
            team: 'TB',
            rank: 212,
            price: 4,
            notes: 'Sleeper pick - Rays system.',
        },
        {
            playerName: 'Noble Meyer',
            team: 'MIA',
            rank: 226,
            price: 6,
            notes: 'Sleeper pick - Marlins system.',
        },
        {
            playerName: 'Jacob Bresnahan',
            team: 'SF',
            rank: 230,
            price: 8,
            notes: 'Sleeper pick - Giants system.',
        },
    ];

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
    console.log('🌱 Seeding pitcher data from BigBobCards article...\n');
    console.log(`📅 Article Date: ${ARTICLE_DATE.toLocaleDateString()}`);
    console.log(`📄 Source: ${ARTICLE_SOURCE}\n`);

    // Initialize database
    initializeDatabase();

    // Create baseline price records
    const prices: BaselinePrice[] = BASELINE_DATA.map(data => ({
        id: uuidv4(),
        playerName: data.playerName,
        normalizedPlayerName: data.playerName.toLowerCase(),
        originalPrice: data.price,
        articleDate: ARTICLE_DATE,
        articleSource: ARTICLE_SOURCE,
        releaseYear: 2025,
        notes: `${data.team} (Rank #${data.rank}) - ${data.notes}`,
        createdAt: new Date(),
    }));

    // Log what we're inserting
    console.log('📊 Pitchers to seed:');
    console.log('─'.repeat(70));
    console.log('  Name                      Rank    Price   Team');
    console.log('─'.repeat(70));
    for (const p of BASELINE_DATA) {
        console.log(`  ${p.playerName.padEnd(24)} #${p.rank.toString().padEnd(6)} $${p.price.toFixed(2).padStart(5)}   ${p.team}`);
    }
    console.log('─'.repeat(70));
    console.log(`  Total: ${BASELINE_DATA.length} pitchers\n`);

    // Insert into database
    const count = bulkInsertBaselinePrices(prices);

    console.log(`\n✅ Successfully seeded ${count} pitcher baseline prices!\n`);

    // Close database
    closeDatabase();

    console.log('💡 Next steps:');
    console.log('   1. Restart the dev server if needed');
    console.log('   2. Navigate to: http://localhost:3001');
    console.log('   3. The new pitchers should appear in the grid\n');
}

main().catch(err => {
    console.error('❌ Error seeding data:', err);
    process.exit(1);
});
