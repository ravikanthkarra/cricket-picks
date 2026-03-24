import 'dotenv/config'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

function createClient() {
  const url = process.env.DATABASE_URL || 'file:./dev.db'
  if (url.startsWith('file:')) {
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
    const absolutePath = path.resolve(process.cwd(), url.replace(/^file:/, ''))
    const adapter = new PrismaBetterSqlite3({ url: `file:${absolutePath}` })
    return new PrismaClient({ adapter } as any)
  } else {
    const { PrismaLibSql } = require('@prisma/adapter-libsql')
    const { createClient: libsqlCreate } = require('@libsql/client')
    const client = libsqlCreate({ url, authToken: process.env.TURSO_AUTH_TOKEN })
    const adapter = new PrismaLibSql(client)
    return new PrismaClient({ adapter } as any)
  }
}

const prisma = createClient()

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

// IPL 2026 official schedule (first 20 matches)
// Times stored as UTC; all matches are 7:30 PM IST (14:00 UTC) or 3:30 PM IST (10:00 UTC)
// Team IDs: MI=1, CSK=2, RCB=3, KKR=4, DC=5, PBKS=6, RR=7, SRH=8, GT=9, LSG=10
// Weeks: Week 1 = Mar 28–Apr 3 | Week 2 = Apr 4–Apr 10 | Week 3 = Apr 11–Apr 12
const matches = [
  // Week 1 — Mar 28 to Apr 3
  { matchNumber: 1,  weekNumber: 1, homeTeamId: 3,  awayTeamId: 8,  venue: 'M. Chinnaswamy Stadium, Bengaluru',              scheduledAt: new Date('2026-03-28T14:00:00Z') }, // RCB vs SRH
  { matchNumber: 2,  weekNumber: 1, homeTeamId: 1,  awayTeamId: 4,  venue: 'Wankhede Stadium, Mumbai',                       scheduledAt: new Date('2026-03-29T14:00:00Z') }, // MI vs KKR
  { matchNumber: 3,  weekNumber: 1, homeTeamId: 7,  awayTeamId: 2,  venue: 'Barsapara Cricket Stadium, Guwahati',            scheduledAt: new Date('2026-03-30T14:00:00Z') }, // RR vs CSK
  { matchNumber: 4,  weekNumber: 1, homeTeamId: 6,  awayTeamId: 9,  venue: 'Punjab Cricket Association Stadium, Mullanpur',  scheduledAt: new Date('2026-03-31T14:00:00Z') }, // PBKS vs GT
  { matchNumber: 5,  weekNumber: 1, homeTeamId: 10, awayTeamId: 5,  venue: 'BRSABV Ekana Cricket Stadium, Lucknow',          scheduledAt: new Date('2026-04-01T14:00:00Z') }, // LSG vs DC
  { matchNumber: 6,  weekNumber: 1, homeTeamId: 4,  awayTeamId: 8,  venue: 'Eden Gardens, Kolkata',                          scheduledAt: new Date('2026-04-02T14:00:00Z') }, // KKR vs SRH
  { matchNumber: 7,  weekNumber: 1, homeTeamId: 2,  awayTeamId: 6,  venue: 'MA Chidambaram Stadium, Chennai',                scheduledAt: new Date('2026-04-03T14:00:00Z') }, // CSK vs PBKS

  // Week 2 — Apr 4 to Apr 10
  { matchNumber: 8,  weekNumber: 2, homeTeamId: 5,  awayTeamId: 1,  venue: 'Arun Jaitley Stadium, Delhi',                   scheduledAt: new Date('2026-04-04T10:00:00Z') }, // DC vs MI  (3:30 PM IST)
  { matchNumber: 9,  weekNumber: 2, homeTeamId: 9,  awayTeamId: 7,  venue: 'Narendra Modi Stadium, Ahmedabad',              scheduledAt: new Date('2026-04-04T14:00:00Z') }, // GT vs RR  (7:30 PM IST)
  { matchNumber: 10, weekNumber: 2, homeTeamId: 8,  awayTeamId: 10, venue: 'Rajiv Gandhi Intl. Stadium, Hyderabad',         scheduledAt: new Date('2026-04-05T10:00:00Z') }, // SRH vs LSG (3:30 PM IST)
  { matchNumber: 11, weekNumber: 2, homeTeamId: 3,  awayTeamId: 2,  venue: 'M. Chinnaswamy Stadium, Bengaluru',             scheduledAt: new Date('2026-04-05T14:00:00Z') }, // RCB vs CSK (7:30 PM IST)
  { matchNumber: 12, weekNumber: 2, homeTeamId: 4,  awayTeamId: 6,  venue: 'Eden Gardens, Kolkata',                         scheduledAt: new Date('2026-04-06T14:00:00Z') }, // KKR vs PBKS
  { matchNumber: 13, weekNumber: 2, homeTeamId: 7,  awayTeamId: 1,  venue: 'Barsapara Cricket Stadium, Guwahati',           scheduledAt: new Date('2026-04-07T14:00:00Z') }, // RR vs MI
  { matchNumber: 14, weekNumber: 2, homeTeamId: 5,  awayTeamId: 9,  venue: 'Arun Jaitley Stadium, Delhi',                   scheduledAt: new Date('2026-04-08T14:00:00Z') }, // DC vs GT
  { matchNumber: 15, weekNumber: 2, homeTeamId: 4,  awayTeamId: 10, venue: 'Eden Gardens, Kolkata',                         scheduledAt: new Date('2026-04-09T14:00:00Z') }, // KKR vs LSG
  { matchNumber: 16, weekNumber: 2, homeTeamId: 7,  awayTeamId: 3,  venue: 'Barsapara Cricket Stadium, Guwahati',           scheduledAt: new Date('2026-04-10T14:00:00Z') }, // RR vs RCB

  // Week 3 — Apr 11 to Apr 12
  { matchNumber: 17, weekNumber: 3, homeTeamId: 6,  awayTeamId: 8,  venue: 'Punjab Cricket Association Stadium, Mullanpur', scheduledAt: new Date('2026-04-11T10:00:00Z') }, // PBKS vs SRH (3:30 PM IST)
  { matchNumber: 18, weekNumber: 3, homeTeamId: 2,  awayTeamId: 5,  venue: 'MA Chidambaram Stadium, Chennai',               scheduledAt: new Date('2026-04-11T14:00:00Z') }, // CSK vs DC  (7:30 PM IST)
  { matchNumber: 19, weekNumber: 3, homeTeamId: 10, awayTeamId: 9,  venue: 'BRSABV Ekana Cricket Stadium, Lucknow',         scheduledAt: new Date('2026-04-12T10:00:00Z') }, // LSG vs GT  (3:30 PM IST)
  { matchNumber: 20, weekNumber: 3, homeTeamId: 1,  awayTeamId: 3,  venue: 'Wankhede Stadium, Mumbai',                      scheduledAt: new Date('2026-04-12T14:00:00Z') }, // MI vs RCB  (7:30 PM IST)
]

async function main() {
  console.log('Clearing old picks and matches...')
  await prisma.pick.deleteMany()
  await prisma.leaderboardEntry.deleteMany()
  await prisma.match.deleteMany()

  console.log('Seeding teams...')
  for (const team of teams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: { logoUrl: team.logoUrl },
      create: team,
    })
  }

  console.log('Seeding matches...')
  for (const match of matches) {
    // Lock at 12:00 AM EDT (04:00 UTC) on the game day — before any match that day can start.
    // EDT = UTC-4; all matches start at 10:00 or 14:00 UTC, so this always precedes tip-off.
    const edtDate = new Date(match.scheduledAt.getTime() - 4 * 60 * 60 * 1000) // shift to EDT
    const lockTime = new Date(Date.UTC(edtDate.getUTCFullYear(), edtDate.getUTCMonth(), edtDate.getUTCDate(), 4, 0, 0))
    await prisma.match.create({
      data: {
        id: match.matchNumber,
        matchNumber: match.matchNumber,
        weekNumber: match.weekNumber,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        venue: match.venue,
        scheduledAt: match.scheduledAt,
        lockTime,
        status: 'upcoming',
      },
    })
  }

  console.log('Creating demo admin user...')
  const adminHash = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { email: 'admin@ipl.com' },
    update: {},
    create: {
      email: 'admin@ipl.com',
      username: 'admin',
      displayName: 'Admin',
      passwordHash: adminHash,
      role: 'admin',
    },
  })

  console.log('Done! Seeded', teams.length, 'teams,', matches.length, 'matches.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
