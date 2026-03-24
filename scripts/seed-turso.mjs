/**
 * Direct Turso seed script — uses libsql client, no Prisma adapter.
 * Run: node scripts/seed-turso.mjs
 */
import { createClient } from '@libsql/client'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')

const url   = 'libsql://ipl-picks-ravikanthkarra.aws-us-east-1.turso.io'
const token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzQwMjg3MTcsImlkIjoiMDE5ZDBjNTktYTcwMS03ZWFhLTliYmUtZjVmNDA1OGU4YTA5IiwicmlkIjoiNGM3YzMxNDYtMWE5NC00NmVlLThlMTQtNjBkZDM5NDQ5NGMzIn0.3ED0XtgaXyx7lMRXwk9bGueDpz8eyStTIWCmwXqqefIte00v6QXum6SF-in4R7Hdimzc-3EuWOH1NQXDdQ9nCQ'

const db = createClient({ url, authToken: token })

const teams = [
  { id: 1,  name: 'Mumbai Indians',             shortName: 'MI',   city: 'Mumbai',    primaryColor: '#004BA0', logoUrl: '/logos/mi.jpg'   },
  { id: 2,  name: 'Chennai Super Kings',         shortName: 'CSK',  city: 'Chennai',   primaryColor: '#F7BE00', logoUrl: '/logos/csk.jpg'  },
  { id: 3,  name: 'Royal Challengers Bengaluru', shortName: 'RCB',  city: 'Bengaluru', primaryColor: '#EC1C24', logoUrl: '/logos/rcb.jpg'  },
  { id: 4,  name: 'Kolkata Knight Riders',       shortName: 'KKR',  city: 'Kolkata',   primaryColor: '#3A225D', logoUrl: '/logos/kkr.jpg'  },
  { id: 5,  name: 'Delhi Capitals',              shortName: 'DC',   city: 'Delhi',     primaryColor: '#17479E', logoUrl: '/logos/dc.jpg'   },
  { id: 6,  name: 'Punjab Kings',                shortName: 'PBKS', city: 'Mohali',    primaryColor: '#ED1B24', logoUrl: '/logos/pbks.jpg' },
  { id: 7,  name: 'Rajasthan Royals',            shortName: 'RR',   city: 'Jaipur',    primaryColor: '#EA1A85', logoUrl: '/logos/rr.jpg'   },
  { id: 8,  name: 'Sunrisers Hyderabad',         shortName: 'SRH',  city: 'Hyderabad', primaryColor: '#FF822A', logoUrl: '/logos/srh.jpg'  },
  { id: 9,  name: 'Gujarat Titans',              shortName: 'GT',   city: 'Ahmedabad', primaryColor: '#1C1C1C', logoUrl: '/logos/gt.jpg'   },
  { id: 10, name: 'Lucknow Super Giants',        shortName: 'LSG',  city: 'Lucknow',   primaryColor: '#A72056', logoUrl: '/logos/lsg.jpg'  },
]

// Lock time = 12:00 AM EDT (04:00 UTC) on match day
function lockTime(scheduledAt) {
  const edt = new Date(scheduledAt.getTime() - 4 * 3600_000)
  return new Date(Date.UTC(edt.getUTCFullYear(), edt.getUTCMonth(), edt.getUTCDate(), 4, 0, 0))
}

const matches = [
  { num: 1,  week: 1, home: 3,  away: 8,  venue: 'M. Chinnaswamy Stadium, Bengaluru',              at: '2026-03-28T14:00:00Z' },
  { num: 2,  week: 1, home: 1,  away: 4,  venue: 'Wankhede Stadium, Mumbai',                       at: '2026-03-29T14:00:00Z' },
  { num: 3,  week: 1, home: 7,  away: 2,  venue: 'Barsapara Cricket Stadium, Guwahati',            at: '2026-03-30T14:00:00Z' },
  { num: 4,  week: 1, home: 6,  away: 9,  venue: 'Punjab Cricket Association Stadium, Mullanpur',  at: '2026-03-31T14:00:00Z' },
  { num: 5,  week: 1, home: 10, away: 5,  venue: 'BRSABV Ekana Cricket Stadium, Lucknow',          at: '2026-04-01T14:00:00Z' },
  { num: 6,  week: 1, home: 4,  away: 8,  venue: 'Eden Gardens, Kolkata',                          at: '2026-04-02T14:00:00Z' },
  { num: 7,  week: 1, home: 2,  away: 6,  venue: 'MA Chidambaram Stadium, Chennai',                at: '2026-04-03T14:00:00Z' },
  { num: 8,  week: 2, home: 5,  away: 1,  venue: 'Arun Jaitley Stadium, Delhi',                   at: '2026-04-04T10:00:00Z' },
  { num: 9,  week: 2, home: 9,  away: 7,  venue: 'Narendra Modi Stadium, Ahmedabad',              at: '2026-04-04T14:00:00Z' },
  { num: 10, week: 2, home: 8,  away: 10, venue: 'Rajiv Gandhi Intl. Stadium, Hyderabad',         at: '2026-04-05T10:00:00Z' },
  { num: 11, week: 2, home: 3,  away: 2,  venue: 'M. Chinnaswamy Stadium, Bengaluru',             at: '2026-04-05T14:00:00Z' },
  { num: 12, week: 2, home: 4,  away: 6,  venue: 'Eden Gardens, Kolkata',                         at: '2026-04-06T14:00:00Z' },
  { num: 13, week: 2, home: 7,  away: 1,  venue: 'Barsapara Cricket Stadium, Guwahati',           at: '2026-04-07T14:00:00Z' },
  { num: 14, week: 2, home: 5,  away: 9,  venue: 'Arun Jaitley Stadium, Delhi',                   at: '2026-04-08T14:00:00Z' },
  { num: 15, week: 2, home: 4,  away: 10, venue: 'Eden Gardens, Kolkata',                         at: '2026-04-09T14:00:00Z' },
  { num: 16, week: 2, home: 7,  away: 3,  venue: 'Barsapara Cricket Stadium, Guwahati',           at: '2026-04-10T14:00:00Z' },
  { num: 17, week: 3, home: 6,  away: 8,  venue: 'Punjab Cricket Association Stadium, Mullanpur', at: '2026-04-11T10:00:00Z' },
  { num: 18, week: 3, home: 2,  away: 5,  venue: 'MA Chidambaram Stadium, Chennai',               at: '2026-04-11T14:00:00Z' },
  { num: 19, week: 3, home: 10, away: 9,  venue: 'BRSABV Ekana Cricket Stadium, Lucknow',         at: '2026-04-12T10:00:00Z' },
  { num: 20, week: 3, home: 1,  away: 3,  venue: 'Wankhede Stadium, Mumbai',                      at: '2026-04-12T14:00:00Z' },
]

async function run() {
  console.log('Clearing picks, leaderboard, matches...')
  await db.execute('DELETE FROM Pick')
  await db.execute('DELETE FROM LeaderboardEntry')
  await db.execute('DELETE FROM Match')

  console.log('Seeding teams...')
  for (const t of teams) {
    await db.execute({
      sql: `INSERT INTO Team (id, name, shortName, city, primaryColor, logoUrl)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET logoUrl = excluded.logoUrl`,
      args: [t.id, t.name, t.shortName, t.city, t.primaryColor, t.logoUrl],
    })
  }
  console.log(`  ✓ ${teams.length} teams`)

  console.log('Seeding matches...')
  for (const m of matches) {
    const at  = new Date(m.at)
    const lk  = lockTime(at)
    await db.execute({
      sql: `INSERT INTO Match (id, matchNumber, weekNumber, homeTeamId, awayTeamId, venue, scheduledAt, lockTime, status, isPlayoff, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'upcoming', 0, datetime('now'))
            ON CONFLICT(id) DO NOTHING`,
      args: [m.num, m.num, m.week, m.home, m.away, m.venue, at.toISOString(), lk.toISOString()],
    })
  }
  console.log(`  ✓ ${matches.length} matches`)

  console.log('Creating admin user...')
  const hash = await bcrypt.hash('admin123', 10)
  // cuid-like id
  const id = 'admin-' + Date.now()
  await db.execute({
    sql: `INSERT INTO User (id, email, username, passwordHash, displayName, role, createdAt)
          VALUES (?, 'admin@ipl.com', 'admin', ?, 'Admin', 'admin', datetime('now'))
          ON CONFLICT(email) DO UPDATE SET passwordHash = excluded.passwordHash, role = 'admin'`,
    args: [id, hash],
  })
  console.log('  ✓ admin@ipl.com / admin123')

  console.log('\nTurso seed complete.')
  db.close()
}

run().catch(err => { console.error(err); process.exit(1) })
