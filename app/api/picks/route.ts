import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const picks = await prisma.pick.findMany({
    where: { userId: session.user.id },
    include: { match: { include: { homeTeam: true, awayTeam: true } }, pickedTeam: true },
  })
  return NextResponse.json(picks)
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { matchId, pickedTeamId, points, marginPick } = body

    if (!matchId || !pickedTeamId) {
      return NextResponse.json({ error: 'Missing matchId or pickedTeamId' }, { status: 400 })
    }

    const match = await prisma.match.findUnique({ where: { id: Number(matchId) } })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    // SQLite stores dates as strings — ensure proper Date comparison
    const now = new Date()
    const lockTime = new Date(match.lockTime)
    if (now >= lockTime) {
      return NextResponse.json({ error: 'Picks are locked for this match' }, { status: 403 })
    }
    if (match.status === 'completed' || match.status === 'cancelled') {
      return NextResponse.json({ error: 'Match is already completed or cancelled' }, { status: 403 })
    }
    if (Number(pickedTeamId) !== match.homeTeamId && Number(pickedTeamId) !== match.awayTeamId) {
      return NextResponse.json({ error: 'Invalid team for this match' }, { status: 400 })
    }

    // Validate confidence points if provided
    if (points !== undefined && points !== null) {
      const pts = Number(points)

      const weekMatchCount = await prisma.match.count({
        where: { weekNumber: match.weekNumber },
      })

      if (pts < 1 || pts > weekMatchCount) {
        return NextResponse.json(
          { error: `Points must be between 1 and ${weekMatchCount}` },
          { status: 400 }
        )
      }

      // Get other match IDs in this week (excluding current match)
      const otherWeekMatches = await prisma.match.findMany({
        where: { weekNumber: match.weekNumber, id: { not: Number(matchId) } },
        select: { id: true },
      })
      const otherMatchIds = otherWeekMatches.map(m => m.id)

      // Only check for conflict if there are other matches in the week
      if (otherMatchIds.length > 0) {
        const conflicting = await prisma.pick.findFirst({
          where: {
            userId: session.user.id,
            points: pts,
            matchId: { in: otherMatchIds },
          },
        })
        if (conflicting) {
          return NextResponse.json(
            { error: `${pts} points already assigned to another match this week` },
            { status: 409 }
          )
        }
      }
    }

    const validMargins = ['BLOWOUT', 'NAIL_BITER', 'EASY', 'NO_MARGIN']
    const normalizedMarginPick = marginPick && validMargins.includes(marginPick) ? marginPick : null

    const pick = await prisma.pick.upsert({
      where: { userId_matchId: { userId: session.user.id, matchId: Number(matchId) } },
      update: {
        pickedTeamId: Number(pickedTeamId),
        points: points !== undefined && points !== null ? Number(points) : null,
        marginPick: normalizedMarginPick,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        matchId: Number(matchId),
        pickedTeamId: Number(pickedTeamId),
        points: points !== undefined && points !== null ? Number(points) : null,
        marginPick: normalizedMarginPick,
      },
      include: { pickedTeam: true },
    })

    return NextResponse.json(pick)
  } catch (error) {
    console.error('[POST /api/picks] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
