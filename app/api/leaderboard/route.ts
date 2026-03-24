import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const entries = await prisma.leaderboardEntry.findMany({
    include: { user: { select: { username: true, displayName: true } } },
    orderBy: [{ totalCorrect: 'desc' }, { totalPicks: 'asc' }],
  })

  const ranked = entries.map((entry, i) => ({ ...entry, rank: i + 1 }))
  return NextResponse.json(ranked)
}
