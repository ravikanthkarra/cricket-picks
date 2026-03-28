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

async function writeAuditLog(
  userId: string,
  matchId: number,
  pickedTeamId: number | null,
  points: number | null,
  marginPick: string | null,
  status: 'success' | 'rejected',
  reason: string | null,
  matchLockTime: Date,
) {
  try {
    await prisma.pickAuditLog.create({
      data: { userId, matchId, pickedTeamId, points, marginPick, status, reason, matchLockTime },
    })
  } catch {
    // Audit log failure must never break the pick submission
  }
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

    const now = new Date()
    const lockTime = new Date(match.lockTime)

    if (now >= lockTime) {
      await writeAuditLog(session.user.id, Number(matchId), Number(pickedTeamId), points ?? null, marginPick ?? null, 'rejected', 'Picks are locked for this match', lockTime)
      return NextResponse.json({ error: 'Picks are locked for this match' }, { status: 403 })
    }

    if (match.status === 'completed' || match.status === 'cancelled') {
      await writeAuditLog(session.user.id, Number(matchId), Number(pickedTeamId), points ?? null, marginPick ?? null, 'rejected', `Match is ${match.status}`, lockTime)
      return NextResponse.json({ error: 'Match is already completed or cancelled' }, { status: 403 })
    }

    if (Number(pickedTeamId) !== match.homeTeamId && Number(pickedTeamId) !== match.awayTeamId) {
      await writeAuditLog(session.user.id, Number(matchId), Number(pickedTeamId), points ?? null, marginPick ?? null, 'rejected', 'Invalid team for this match', lockTime)
      return NextResponse.json({ error: 'Invalid team for this match' }, { status: 400 })
    }

    // Validate confidence points if provided
    if (points !== undefined && points !== null) {
      const pts = Number(points)

      const weekMatchCount = await prisma.match.count({
        where: { weekNumber: match.weekNumber },
      })

      if (pts < 1 || pts > weekMatchCount) {
        await writeAuditLog(session.user.id, Number(matchId), Number(pickedTeamId), pts, marginPick ?? null, 'rejected', `Points ${pts} out of range (1–${weekMatchCount})`, lockTime)
        return NextResponse.json(
          { error: `Points must be between 1 and ${weekMatchCount}` },
          { status: 400 }
        )
      }

      const otherWeekMatches = await prisma.match.findMany({
        where: { weekNumber: match.weekNumber, id: { not: Number(matchId) } },
        select: { id: true },
      })
      const otherMatchIds = otherWeekMatches.map(m => m.id)

      if (otherMatchIds.length > 0) {
        const conflicting = await prisma.pick.findFirst({
          where: { userId: session.user.id, points: pts, matchId: { in: otherMatchIds } },
        })
        if (conflicting) {
          await writeAuditLog(session.user.id, Number(matchId), Number(pickedTeamId), pts, marginPick ?? null, 'rejected', `Points ${pts} already used on match ${conflicting.matchId} this week`, lockTime)
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

    await writeAuditLog(session.user.id, Number(matchId), Number(pickedTeamId), points ?? null, normalizedMarginPick, 'success', null, lockTime)

    return NextResponse.json(pick)
  } catch (error) {
    console.error('[POST /api/picks] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
