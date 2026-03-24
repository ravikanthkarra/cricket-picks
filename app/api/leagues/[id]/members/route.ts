import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leagueId = parseInt(params.id)
  const week = req.nextUrl.searchParams.get('week')

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { members: { include: { user: true } } },
  })
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })

  const isLeagueAdmin = league.adminId === session.user.id
  const isAppAdmin = session.user.role === 'admin'
  if (!isLeagueAdmin && !isAppAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get matches for the selected week (or all upcoming weeks if no week specified)
  const selectedWeek = week ? parseInt(week) : null
  const weekMatches = await prisma.match.findMany({
    where: selectedWeek ? { weekNumber: selectedWeek } : {},
    select: { id: true, weekNumber: true, status: true, lockTime: true },
  })
  const totalMatchesInWeek = weekMatches.length

  // For each member, count how many of those matches they've picked
  const memberStats = await Promise.all(
    league.members.map(async (member) => {
      const pickCount = await prisma.pick.count({
        where: {
          userId: member.userId,
          matchId: { in: weekMatches.map(m => m.id) },
        },
      })
      const correctCount = await prisma.pick.count({
        where: {
          userId: member.userId,
          matchId: { in: weekMatches.map(m => m.id) },
          isCorrect: true,
        },
      })
      return {
        id: member.id,
        userId: member.userId,
        username: member.user.username,
        displayName: member.user.displayName,
        joinedAt: member.joinedAt,
        picksCompleted: pickCount,
        picksTotal: totalMatchesInWeek,
        correctPicks: correctCount,
        isComplete: pickCount === totalMatchesInWeek,
        isLeagueAdmin: member.userId === league.adminId,
      }
    })
  )

  return NextResponse.json({ members: memberStats, week: selectedWeek, totalMatches: totalMatchesInWeek })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leagueId = parseInt(params.id)
  const { userId } = await req.json()

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isLeagueAdmin = league.adminId === session.user.id
  const isAppAdmin = session.user.role === 'admin'
  if (!isLeagueAdmin && !isAppAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (userId === league.adminId) return NextResponse.json({ error: 'Cannot remove the league admin' }, { status: 400 })

  await prisma.leagueMember.deleteMany({
    where: { leagueId, userId },
  })

  return NextResponse.json({ success: true })
}
