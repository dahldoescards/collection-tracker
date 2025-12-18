/**
 * =============================================================================
 * SEED DECEMBER ARTICLES - Early Debut Candidates
 * =============================================================================
 * 
 * Script to seed prospect data from BigBobCards December articles.
 * Players predicted to make early MLB debuts in 2026.
 * 
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-dec-articles.ts
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
// ARTICLE DATA - December 2025 Early Debut Series
// =============================================================================

interface PlayerData {
    playerName: string;
    team: string;
    price: number;
    articleDate: string;
    notes: string;
}

// 12/05/25 - NL East Early Debuts
const NL_EAST_DEC_5: PlayerData[] = [
    {
        playerName: 'JR Ritchie',
        team: 'ATL',
        price: 38,
        articleDate: '2025-12-05',
        notes: '22yo RHP, 2.64 ERA in 26 starts across 3 levels. 97mph FB, nasty slider, effective changeup. Braves aggressive with promotions. First call-up candidate for spot starts.',
    },
    {
        playerName: 'Joe Mack',
        team: 'MIA',
        price: 20,
        articleDate: '2025-12-05',
        notes: 'Catcher of the future for Marlins. 21 HR this year, .218 ISO, 120 wRC+. Elite defensive catcher. Clearest path to starting gig of any non-debuted prospect. Opening Day roster shot.',
    },
    {
        playerName: 'Ryan Clifford',
        team: 'NYM',
        price: 22,
        articleDate: '2025-12-05',
        notes: 'Most undervalued Mets prospect. 29 HR, .233 ISO, 137 wRC+ in AA/AAA. Passive approach but mashes. If Alonso not re-signed, Clifford is AAA 1B. Could debut before All-Star break.',
    },
    {
        playerName: 'Gabriel Rincones Jr.',
        team: 'PHI',
        price: 7,
        articleDate: '2025-12-05',
        notes: '6\'3" 225lbs, Caglianone comp. 18 HR, 21 SB, .189 ISO, 115 wRC+ in AAA. Now on 40-man roster. Stock down but seen $20+ when hype builds. Easiest path to doubling/tripling.',
    },
    {
        playerName: 'Yohandy Morales',
        team: 'WAS',
        price: 6,
        articleDate: '2025-12-05',
        notes: 'Power bat from U of Miami. 15 HR, .165 ISO in AA/AAA. Hot 2nd half (.292/6 HR July, .298/4 HR Aug). 76.8% AAA starts at 1B - weakest position for Nats. Cheap gamble.',
    },
];

// 12/08/25 - NL Central Early Debuts
const NL_CENTRAL_DEC_8: PlayerData[] = [
    {
        playerName: 'Jonathon Long',
        team: 'CHC',
        price: 26,
        articleDate: '2025-12-08',
        notes: '1B with elite contact. .305/20 HR, 131 wRC+, 80.7% contact rate in AAA. Only 3 prospects u23 hit .300+ with 20+ HR: Sal Stewart, Konnor Griffin, Jonathon Long. Should debut before ASB.',
    },
    {
        playerName: 'Hector Rodriguez',
        team: 'CIN',
        price: 36,
        articleDate: '2025-12-08',
        notes: 'Now on 40-man roster. .283/19 HR/15 SB, 118 wRC+ at age 21. Just 15% K rate. Versatile OF defense. Same price tier as Collier/Duno/Lewis but will debut in 2026.',
    },
    {
        playerName: 'Jeferson Quero',
        team: 'MIL',
        price: 17,
        articleDate: '2025-12-08',
        notes: 'One of best defensive catchers in MiLB - 2023 MiLB Gold Glove. .271/11 HR, .207 ISO, 121 wRC+ after injuries. 30%+ CS rate. Better approach (0.80 BB/K). Opening Day roster likely.',
    },
    {
        playerName: 'Termarr Johnson',
        team: 'PIT',
        price: 30,
        articleDate: '2025-12-08',
        notes: '4th overall pick 2022. Contact improving: K% dropped 26% to 18.5%, contact up 68.8% to 75.1%. Hit .272 this year (+35 pts). Power still in tank. 2B job open in PIT. Buy low spot.',
    },
    {
        playerName: 'Quinn Mathews',
        team: 'STL',
        price: 28,
        articleDate: '2025-12-08',
        notes: '6\'5" LHP. 2024: 2.76 ERA, 202 K in 143 IP across 4 levels. Plus changeup best pitch. Cardinals lost Gray/Mikolas/Fedde from rotation. Could make Opening Day roster if good in Spring.',
    },
];

// 12/12/25 - NL West Early Debuts
const NL_WEST_DEC_12: PlayerData[] = [
    {
        playerName: 'Tommy Troy',
        team: 'ARI',
        price: 16,
        articleDate: '2025-12-12',
        notes: '12th overall pick 2023. Resurgent 2025: .289, .162 ISO, 114 wRC+. One of only 2 prospects with 15+ HR, 20+ SB, 10%+ BB, <17% K (other: Wetherholt). 2B spot opens if Marte traded.',
    },
    {
        playerName: 'Sterlin Thompson',
        team: 'COL',
        price: 13,
        articleDate: '2025-12-12',
        notes: 'Slam dunk debut pick. Best season: .296, .223 ISO in AAA. Only 2 non-debuted u24 with .295+/.220+ ISO: McGonigle and Thompson. Hot finish: .370/8 HR in Aug-Sep. Forces their hand.',
    },
    {
        playerName: 'Jackson Ferris',
        team: 'LAD',
        price: 16,
        articleDate: '2025-12-12',
        notes: '6\'4" LHP from Cubs trade. 10-7, 3.86 ERA in AA. Snell comparisons. Dodgers rotation injury-prone (10 of 12 arms are RHP). Best LHP option if fast-tracked. Big ranking year.',
    },
    {
        playerName: 'Jase Bowen',
        team: 'SD',
        price: 8,
        articleDate: '2025-12-12',
        notes: 'Hobby community member. 124 wRC+, .272/.176 ISO, 20 SB. Walk rate doubled (6.4% to 10.7%). Elite company: one of 18 to hit .270+/.175+ ISO with 20+ SB. Sneaky debut play.',
    },
    {
        playerName: 'Jesus Rodriguez',
        team: 'SF',
        price: 9,
        articleDate: '2025-12-12',
        notes: 'Elite bat-to-ball: .307, 85.6% contact, 6.9% SwStr%, 0.85 BB/K. Only non-debuted u23 with 10%+ BB, <14% K, 85%+ contact. Defensive home unclear but Giants want his bat.',
    },
];

// 12/16/25 - AL East Early Debuts
const AL_EAST_DEC_16: PlayerData[] = [
    {
        playerName: 'Luis De Leon',
        team: 'BAL',
        price: 15,
        articleDate: '2025-12-16',
        notes: '6\'3" LHP. Electric stuff: mid-upper 90s FB with sink, nasty slider, good changeup. 3.30 ERA, 11.03 K/9 this year. BB/9 improved to 4.23. Two promotions. Great bullpen arm or more.',
    },
    {
        playerName: 'David Sandlin',
        team: 'BOS',
        price: 6,
        articleDate: '2025-12-16',
        notes: 'Stuff grades elite: FB tops 100, sweeping slider, splitter. Top 10 in K/9 over 12.5 with BB/9 under 3. HR/9 dropped from 2.20 to 0.85. Moved to bullpen - expedites arrival.',
    },
    {
        playerName: 'Carlos Lagrange',
        team: 'NYY',
        price: 24,
        articleDate: '2025-12-16',
        notes: '6\'7" RHP. FB tops 102mph, really good slider. Vaulted from outside top-100 to top-20 pitching prospects. Walk rate dropped 20% to 7.1% in A+. Could have Cam Schlitter-type electric debut.',
    },
    {
        playerName: 'Tre\' Morgan',
        team: 'TB',
        price: 43,
        articleDate: '2025-12-16',
        notes: 'REFRACTOR AUTO /499 (no base). Best defensive 1B in MiLB. Elite contact: .274, 118 wRC+, 15.9% BB, 19.2% K. Hot Sept: .339/.440/.581. Rays want his bat and glove.',
    },
    {
        playerName: 'RJ Schreck',
        team: 'TOR',
        price: 6,
        articleDate: '2025-12-16',
        notes: 'Shockingly cheap for production. .249/18 HR, 143 wRC+, .211 ISO, 79.9% contact. Elite company: only 5 with .200+ ISO and <8.5% SwStr% (others: McGonigle, Wetherholt, Quintero, Florentino).',
    },
];

// =============================================================================
// COMBINE ALL DATA
// =============================================================================

const ALL_PLAYERS: PlayerData[] = [
    ...NL_EAST_DEC_5,
    ...NL_CENTRAL_DEC_8,
    ...NL_WEST_DEC_12,
    ...AL_EAST_DEC_16,
];

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
    console.log('🌱 Seeding December Early Debut articles...\n');
    console.log('📅 Articles: 12/05, 12/08, 12/12, 12/16 2025');
    console.log(`📊 Total players: ${ALL_PLAYERS.length}\n`);

    // Initialize database
    initializeDatabase();

    // Create baseline price records
    const prices: BaselinePrice[] = ALL_PLAYERS.map(data => ({
        id: uuidv4(),
        playerName: data.playerName,
        normalizedPlayerName: data.playerName.toLowerCase(),
        originalPrice: data.price,
        articleDate: new Date(data.articleDate),
        articleSource: `bigbobcards-early-debut-${data.articleDate}`,
        releaseYear: 2025,
        notes: `${data.team} - ${data.notes}`,
        createdAt: new Date(),
    }));

    // Log by article date
    console.log('📋 Players by Article:\n');

    console.log('--- 12/05/25 - NL East ---');
    for (const p of NL_EAST_DEC_5) {
        console.log(`  ${p.playerName.padEnd(22)} ${p.team}  $${p.price.toFixed(2).padStart(5)}`);
    }

    console.log('\n--- 12/08/25 - NL Central ---');
    for (const p of NL_CENTRAL_DEC_8) {
        console.log(`  ${p.playerName.padEnd(22)} ${p.team}  $${p.price.toFixed(2).padStart(5)}`);
    }

    console.log('\n--- 12/12/25 - NL West ---');
    for (const p of NL_WEST_DEC_12) {
        console.log(`  ${p.playerName.padEnd(22)} ${p.team}  $${p.price.toFixed(2).padStart(5)}`);
    }

    console.log('\n--- 12/16/25 - AL East ---');
    for (const p of AL_EAST_DEC_16) {
        console.log(`  ${p.playerName.padEnd(22)} ${p.team}  $${p.price.toFixed(2).padStart(5)}`);
    }

    console.log('\n' + '─'.repeat(50));
    console.log(`  Total: ${ALL_PLAYERS.length} prospects`);
    console.log('─'.repeat(50));

    // Insert into database
    const count = bulkInsertBaselinePrices(prices);

    console.log(`\n✅ Successfully seeded ${count} early debut candidates!\n`);

    // Close database
    closeDatabase();

    console.log('💡 Next steps:');
    console.log('   1. View dashboard at http://localhost:3001');
    console.log('   2. Click "Refresh All" to fetch current prices');
    console.log('   3. New total should be 67 cards (47 + 20)\n');
}

main().catch(err => {
    console.error('❌ Error seeding data:', err);
    process.exit(1);
});
