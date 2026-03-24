import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get('week')
  const matches = await prisma.match.findMany({
    where: week ? { weekNumber: parseInt(week) } : undefined,
    include: { homeTeam: true, awayTeam: true, winningTeam: true },
    orderBy: [{ weekNumber: 'asc' }, { scheduledAt: 'asc' }],
  })
  return NextResponse.json(matches)
}
