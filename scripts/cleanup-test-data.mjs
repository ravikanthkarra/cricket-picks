/**
 * cleanup-test-data.mjs
 *
 * Removes all test data created by setup-test-data.mjs.
 * Safe to run multiple times — only deletes records tagged as test data.
 * Run: node scripts/cleanup-test-data.mjs
 */

import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
dotenv.config()

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const TEST_MATCH_IDS = [9001, 9002, 9003, 9004]
const TEST_USER_IDS  = ['test-user-1', 'test-user-2']

async function run() {
  console.log('Cleaning up test data...\n')

  // 1. Picks for test matches (all users, including admin's test picks)
  await client.execute({
    sql: `DELETE FROM Pick WHERE matchId IN (${TEST_MATCH_IDS.join(',')})`,
    args: [],
  })
  console.log('  ✓ Picks for test matches deleted')

  // 2. Picks made by test users (for any match)
  await client.execute({
    sql: `DELETE FROM Pick WHERE userId IN (${TEST_USER_IDS.map(() => '?').join(',')})`,
    args: TEST_USER_IDS,
  })
  console.log('  ✓ Picks by test users deleted')

  // 3. LeaderboardEntry for test users
  await client.execute({
    sql: `DELETE FROM LeaderboardEntry WHERE userId IN (${TEST_USER_IDS.map(() => '?').join(',')})`,
    args: TEST_USER_IDS,
  })
  console.log('  ✓ LeaderboardEntry rows deleted')

  // 4. Also reset admin's LeaderboardEntry to exclude test match points
  //    (recalculate from real picks only)
  const adminRow = await client.execute({ sql: `SELECT id FROM User WHERE email = 'admin@ipl.com'`, args: [] })
  if (adminRow.rows.length > 0) {
    const adminId = adminRow.rows[0].id
    const realPicks = await client.execute({
      sql: `SELECT p.points, p.isCorrect, p.marginPoints
            FROM Pick p
            JOIN Match m ON p.matchId = m.id
            WHERE p.userId = ? AND p.isCorrect IS NOT NULL AND m.series != 'TEST'`,
      args: [adminId],
    })
    const totalPoints = realPicks.rows.reduce((sum, p) => {
      const conf = p.isCorrect ? (p.points ?? 1) : 0
      const marg = p.marginPoints ?? 0
      return sum + conf + marg
    }, 0)
    const totalPicks = realPicks.rows.length
    await client.execute({
      sql: `INSERT INTO LeaderboardEntry (userId, totalCorrect, totalPicks, updatedAt)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(userId) DO UPDATE SET totalCorrect = excluded.totalCorrect, totalPicks = excluded.totalPicks, updatedAt = excluded.updatedAt`,
      args: [adminId, totalPoints, totalPicks],
    })
    console.log(`  ✓ Admin leaderboard entry restored (${totalPoints} pts from real picks)`)
  }

  // 5. Test matches
  await client.execute({
    sql: `DELETE FROM Match WHERE id IN (${TEST_MATCH_IDS.join(',')})`,
    args: [],
  })
  console.log('  ✓ Test matches deleted')

  // 6. Test users (emails ending in @test.local)
  await client.execute({
    sql: `DELETE FROM User WHERE email LIKE '%@test.local'`,
    args: [],
  })
  console.log('  ✓ Test users deleted')

  console.log('\n✅ All test data removed. Production data is untouched.')
}

run().catch(err => { console.error(err); process.exit(1) })
