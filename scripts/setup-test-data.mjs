/**
 * setup-test-data.mjs
 *
 * Creates isolated test data tagged with series = "TEST".
 * Run: node scripts/setup-test-data.mjs
 *
 * What it creates:
 *   - 2 test users  (testplayer1@test.local, testplayer2@test.local)
 *   - 4 test matches in series "TEST" with past dates (week 99 + week 100)
 *       Matches 9001 & 9002 → completed with results
 *       Matches 9003 & 9004 → locked but no result (admin can set via UI)
 *   - Picks for admin + both test users on all 4 matches
 *   - LeaderboardEntry rows for test users (from completed matches)
 *
 * Cleanup: node scripts/cleanup-test-data.mjs
 */

import { createClient } from '@libsql/client'
import { createRequire } from 'module'
import * as dotenv from 'dotenv'
dotenv.config()

const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// ─── Test users ──────────────────────────────────────────────────────────────
const TEST_USERS = [
  { id: 'test-user-1', email: 'testplayer1@test.local', username: 'testplayer1', displayName: 'Test Player 1' },
  { id: 'test-user-2', email: 'testplayer2@test.local', username: 'testplayer2', displayName: 'Test Player 2' },
]

// ─── Test matches (past dates, series = "TEST") ───────────────────────────────
// Uses real team IDs: 1=MI 2=CSK 3=RCB 4=KKR 5=DC 6=PBKS 7=RR 8=SRH 9=GT 10=LSG
const past = (daysAgo) => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(14, 0, 0, 0)
  return d.toISOString()
}

const TEST_MATCHES = [
  // Week 99 — both completed
  { id: 9001, matchNumber: 9001, weekNumber: 99, series: 'TEST', homeTeamId: 2, awayTeamId: 1, venue: 'Test Stadium, Chennai', scheduledAt: past(5), lockTime: past(5), status: 'completed', winningTeamId: 2, margin: 'BLOWOUT' },
  { id: 9002, matchNumber: 9002, weekNumber: 99, series: 'TEST', homeTeamId: 3, awayTeamId: 4, venue: 'Test Stadium, Bengaluru', scheduledAt: past(4), lockTime: past(4), status: 'completed', winningTeamId: 3, margin: 'NAIL_BITER' },
  // Week 100 — locked, no result yet (admin can set these via Admin page)
  { id: 9003, matchNumber: 9003, weekNumber: 100, series: 'TEST', homeTeamId: 5, awayTeamId: 7, venue: 'Test Stadium, Delhi', scheduledAt: past(2), lockTime: past(2), status: 'upcoming', winningTeamId: null, margin: null },
  { id: 9004, matchNumber: 9004, weekNumber: 100, series: 'TEST', homeTeamId: 8, awayTeamId: 9, venue: 'Test Stadium, Hyderabad', scheduledAt: past(1), lockTime: past(1), status: 'upcoming', winningTeamId: null, margin: null },
]

// ─── Picks ────────────────────────────────────────────────────────────────────
// Week 99: 2 matches → points 1 & 2 per user
// Match 9001 winner: CSK (id=2), margin: BLOWOUT (+4/-3)
// Match 9002 winner: RCB (id=3), margin: NAIL_BITER (+3/-2)
//
// admin picks:     CSK(2pts) + RCB(1pt)  → both correct → 2 + 1 + 4 + 3 = 10pts
// testplayer1:     CSK(1pt)  + KKR(2pts) → 1 correct, 1 wrong → 1 + 0 = 1pt  (margin penalty on KKR pick ignored since wrong team)
// testplayer2:     MI(2pts)  + RCB(1pt)  → 1 wrong, 1 correct → 0 + 1 + 3 = 4pts (RCB correct + NAIL_BITER bonus)
//
// Week 100: locked, no results yet — picks are shown in Match Picks section
const TEST_PICKS = [
  // admin (id fetched at runtime)
  { matchId: 9001, pickedTeamId: 2, points: 2, marginPick: 'BLOWOUT',    isCorrect: true,  marginPoints: 4 },
  { matchId: 9002, pickedTeamId: 3, points: 1, marginPick: 'NAIL_BITER', isCorrect: true,  marginPoints: 3 },
  { matchId: 9003, pickedTeamId: 5, points: 2, marginPick: 'EASY',       isCorrect: null,  marginPoints: null },
  { matchId: 9004, pickedTeamId: 8, points: 1, marginPick: 'NO_MARGIN',  isCorrect: null,  marginPoints: null },
]
const TEST_PICKS_USER1 = [
  { matchId: 9001, pickedTeamId: 2, points: 1, marginPick: 'NAIL_BITER', isCorrect: true,  marginPoints: -2 }, // correct team, wrong margin → penalty
  { matchId: 9002, pickedTeamId: 4, points: 2, marginPick: 'BLOWOUT',    isCorrect: false, marginPoints: 0  },
  { matchId: 9003, pickedTeamId: 7, points: 1, marginPick: 'NO_MARGIN',  isCorrect: null,  marginPoints: null },
  { matchId: 9004, pickedTeamId: 9, points: 2, marginPick: 'BLOWOUT',    isCorrect: null,  marginPoints: null },
]
const TEST_PICKS_USER2 = [
  { matchId: 9001, pickedTeamId: 1, points: 2, marginPick: 'BLOWOUT',    isCorrect: false, marginPoints: 0  },
  { matchId: 9002, pickedTeamId: 3, points: 1, marginPick: 'NAIL_BITER', isCorrect: true,  marginPoints: 3  },
  { matchId: 9003, pickedTeamId: 5, points: 1, marginPick: 'BLOWOUT',    isCorrect: null,  marginPoints: null },
  { matchId: 9004, pickedTeamId: 8, points: 2, marginPick: 'EASY',       isCorrect: null,  marginPoints: null },
]

async function run() {
  console.log('Setting up test data...\n')

  // 1. Create test users
  const hash = await bcrypt.hash('Test@123', 10)
  for (const u of TEST_USERS) {
    await client.execute({
      sql: `INSERT INTO User (id, email, username, passwordHash, displayName, role, createdAt)
            VALUES (?, ?, ?, ?, ?, 'user', datetime('now'))
            ON CONFLICT(email) DO NOTHING`,
      args: [u.id, u.email, u.username, hash, u.displayName],
    })
    console.log(`  ✓ User: ${u.email} / Test@123`)
  }

  // 2. Create test matches
  for (const m of TEST_MATCHES) {
    await client.execute({
      sql: `INSERT INTO Match (id, matchNumber, weekNumber, series, homeTeamId, awayTeamId, venue, scheduledAt, lockTime, status, winningTeamId, margin, isPlayoff, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
            ON CONFLICT(id) DO NOTHING`,
      args: [m.id, m.matchNumber, m.weekNumber, m.series, m.homeTeamId, m.awayTeamId, m.venue, m.scheduledAt, m.lockTime, m.status, m.winningTeamId, m.margin],
    })
    console.log(`  ✓ Match ${m.id}: week ${m.weekNumber}, ${m.status}`)
  }

  // 3. Get admin user id
  const adminRow = await client.execute({ sql: `SELECT id FROM User WHERE email = 'admin@ipl.com'`, args: [] })
  if (adminRow.rows.length === 0) { console.error('Admin user not found — run seed-turso.mjs first'); process.exit(1) }
  const adminId = adminRow.rows[0].id

  // 4. Insert picks
  const allPicks = [
    { userId: adminId,      picks: TEST_PICKS       },
    { userId: 'test-user-1', picks: TEST_PICKS_USER1 },
    { userId: 'test-user-2', picks: TEST_PICKS_USER2 },
  ]
  let pickId = 90010
  for (const { userId, picks } of allPicks) {
    for (const p of picks) {
      await client.execute({
        sql: `INSERT INTO Pick (id, userId, matchId, pickedTeamId, points, marginPick, marginPoints, isCorrect, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
              ON CONFLICT(userId, matchId) DO NOTHING`,
        args: [pickId++, userId, p.matchId, p.pickedTeamId, p.points, p.marginPick, p.marginPoints, p.isCorrect],
      })
    }
    console.log(`  ✓ Picks inserted for userId: ${userId}`)
  }

  // 5. Leaderboard entries for test users (based on completed matches only)
  // admin: conf(2+1) + margin(4+3) = 10pts, testplayer1: 1-2=−1pt (but floor at 0? let's keep real), testplayer2: 1+3=4pts
  const lbData = [
    { userId: adminId,       totalCorrect: 10, totalPicks: 2 },
    { userId: 'test-user-1', totalCorrect: -1, totalPicks: 2 },
    { userId: 'test-user-2', totalCorrect: 4,  totalPicks: 2 },
  ]
  for (const lb of lbData) {
    await client.execute({
      sql: `INSERT INTO LeaderboardEntry (userId, totalCorrect, totalPicks, updatedAt)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(userId) DO UPDATE SET totalCorrect = excluded.totalCorrect, totalPicks = excluded.totalPicks, updatedAt = excluded.updatedAt`,
      args: [lb.userId, lb.totalCorrect, lb.totalPicks],
    })
  }
  console.log('  ✓ LeaderboardEntry rows updated')

  console.log('\n✅ Test data ready!')
  console.log('\nWhat to test:')
  console.log('  1. Go to /leaderboard → select "TEST" series tab')
  console.log('     → Overall: Admin leads (10pts), Test Player 2 (4pts), Test Player 1 (−1pt)')
  console.log('     → Weekly standings: Week 99 complete, Week 100 locked/no result')
  console.log('     → Match Picks: all 4 matches visible (lock time is past)')
  console.log('  2. Go to /admin → set result for Match 9003 or 9004')
  console.log('     → Leaderboard should update after result is saved')
  console.log('  3. Login as testplayer1@test.local / Test@123 to see their view')
  console.log('\nCleanup: node scripts/cleanup-test-data.mjs')
}

run().catch(err => { console.error(err); process.exit(1) })
