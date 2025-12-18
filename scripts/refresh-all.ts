#!/usr/bin/env npx tsx
/**
 * Daily Refresh Script
 * 
 * This script refreshes all players in the database by calling the collection API.
 * It can be run via cron or manually.
 * 
 * Usage:
 *   npm run refresh-all
 *   # or
 *   npx tsx scripts/refresh-all.ts
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function refreshAllPlayers() {
    console.log('🔄 Starting daily sales refresh...');
    console.log(`📡 Using API: ${BASE_URL}`);
    console.log(`🕐 Time: ${new Date().toISOString()}`);
    console.log('---');

    try {
        const response = await fetch(`${BASE_URL}/api/collection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshAll: true }),
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        console.log('✅ Refresh complete!');
        console.log(`   Players refreshed: ${result.refreshed}`);
        console.log(`   Players failed: ${result.failed}`);
        console.log('---');

        if (result.failed > 0) {
            console.log('⚠️  Some players failed to refresh. Check the server logs for details.');
        }

        return result;
    } catch (error) {
        console.error('❌ Refresh failed:', error);
        process.exit(1);
    }
}

// Run if called directly
refreshAllPlayers().then(() => {
    console.log('🏁 Script finished');
    process.exit(0);
});
