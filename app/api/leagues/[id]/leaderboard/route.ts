import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leagueId = parseInt(params.id)
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { members: { select: { userId: true } } },
  })
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })

  const isMember = league.members.some(m => m.userId === session.user.id)
  const isAppAdmin = session.user.role === 'admin'
  if (!isMember && !isAppAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const memberUserIds = league.members.map(m => m.userId)

  const entries = await prisma.leaderboardEntry.findMany({
    where: { userId: { in: memberUserIds } },
    include: { user: { select: { username: true, displayName: true } } },
    orderBy: [{ totalCorrect: 'desc' }, { totalPicks: 'asc' }],
  })

  const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }))
  return NextResponse.json(ranked)
}
