import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calcConfPoints } from '@/lib/marginConfig'
import { Prisma } from '@prisma/client'

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const matchId = parseInt(params.id)
  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.match.update({
      where: { id: matchId },
      data: { status: 'no_result', winningTeamId: null, margin: null },
    })

    // All picks are credited (isCorrect = true); half points applied at scoring time via match status
    await tx.pick.updateMany({
      where: { matchId },
      data: { isCorrect: true, marginPoints: 0 },
    })

    // Recalculate global leaderboard for affected users
    const affectedPicks = await tx.pick.findMany({ where: { matchId }, select: { userId: true } })
    const userIds = Array.from(new Set(affectedPicks.map(p => p.userId)))

    for (const userId of userIds) {
      const allUserPicks = await tx.pick.findMany({
        where: { userId, isCorrect: { not: null } },
        select: { points: true, isCorrect: true, marginPoints: true, match: { select: { status: true } } },
      })

      const totalPoints = allUserPicks.reduce((sum, p) => {
        const conf = calcConfPoints(p.points, p.isCorrect, p.match.status)
        return sum + conf + (p.marginPoints ?? 0)
      }, 0)

      await tx.leaderboardEntry.upsert({
        where: { userId },
        update: { totalCorrect: totalPoints, totalPicks: allUserPicks.length },
        create: { userId, totalCorrect: totalPoints, totalPicks: allUserPicks.length },
      })
    }
  })

  return NextResponse.json({ success: true })
}
