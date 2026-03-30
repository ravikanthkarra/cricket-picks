import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_MARGIN_CONFIG, calcMarginPoints, calcConfPoints } from '@/lib/marginConfig'
import { Prisma } from '@prisma/client'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { winningTeamId, margin } = await req.json()
  const matchId = parseInt(params.id)

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const validMargins = Object.keys(DEFAULT_MARGIN_CONFIG)
  const normalizedMargin: string | null = margin && validMargins.includes(margin) ? margin : null

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Set match result and margin
    await tx.match.update({
      where: { id: matchId },
      data: { winningTeamId, status: 'completed', margin: normalizedMargin },
    })

    // Mark all picks correct or incorrect
    await tx.pick.updateMany({
      where: { matchId, pickedTeamId: winningTeamId },
      data: { isCorrect: true },
    })
    await tx.pick.updateMany({
      where: { matchId, pickedTeamId: { not: winningTeamId } },
      data: { isCorrect: false },
    })

    // Calculate and store marginPoints for every pick using global default config.
    // (League leaderboards recalculate with per-league config at query time.)
    const allPicks = await tx.pick.findMany({
      where: { matchId },
      select: { id: true, marginPick: true, isCorrect: true },
    })

    for (const pick of allPicks) {
      const marginPts = calcMarginPoints(
        pick.marginPick,
        normalizedMargin,
        pick.isCorrect ?? false,
        DEFAULT_MARGIN_CONFIG
      )
      await tx.pick.update({
        where: { id: pick.id },
        data: { marginPoints: marginPts },
      })
    }

    // Recalculate global leaderboard for all affected users
    const affectedPicks = await tx.pick.findMany({ where: { matchId }, select: { userId: true } })
    const userIds = Array.from(new Set(affectedPicks.map(p => p.userId)))

    for (const userId of userIds) {
      const totalPicks = await tx.pick.count({ where: { userId, isCorrect: { not: null } } })

      const allUserPicks = await tx.pick.findMany({
        where: { userId, isCorrect: { not: null } },
        select: { points: true, isCorrect: true, marginPoints: true, match: { select: { status: true } } },
      })

      const totalPoints = allUserPicks.reduce((sum, p) => {
        const conf = calcConfPoints(p.points, p.isCorrect, p.match.status)
        const marg = p.marginPoints ?? 0
        return sum + conf + marg
      }, 0)

      await tx.leaderboardEntry.upsert({
        where: { userId },
        update: { totalCorrect: totalPoints, totalPicks },
        create: { userId, totalCorrect: totalPoints, totalPicks },
      })
    }
  })

  return NextResponse.json({ success: true })
}
