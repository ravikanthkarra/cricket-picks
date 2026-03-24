import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/profile/fanboy?series=IPL+2026
// Returns the user's fanboy entry for the given series (or all series if no query param)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const series = req.nextUrl.searchParams.get('series')

  if (series) {
    const entry = await prisma.userSeriesFanboy.findUnique({
      where: { userId_series: { userId: session.user.id, series } },
      include: { team: true },
    })
    return NextResponse.json(entry)
  }

  const entries = await prisma.userSeriesFanboy.findMany({
    where: { userId: session.user.id },
    include: { team: true },
  })
  return NextResponse.json(entries)
}

// PUT /api/profile/fanboy
// Body: { series, teamId }
// Sets or changes fanboy team. Change allowed only once (changedAt tracks this).
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { series, teamId } = await req.json()
  if (!series || !teamId) return NextResponse.json({ error: 'series and teamId required' }, { status: 400 })

  // Verify team exists
  const team = await prisma.team.findUnique({ where: { id: Number(teamId) } })
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const existing = await prisma.userSeriesFanboy.findUnique({
    where: { userId_series: { userId: session.user.id, series } },
  })

  if (existing) {
    // Already has a fanboy team for this series
    if (existing.changedAt) {
      // Already used their one change — block
      return NextResponse.json(
        { error: 'You have already used your one allowed change for this series.' },
        { status: 403 }
      )
    }
    // First change — allow, set changedAt
    const updated = await prisma.userSeriesFanboy.update({
      where: { userId_series: { userId: session.user.id, series } },
      data: { teamId: Number(teamId), changedAt: new Date() },
      include: { team: true },
    })
    return NextResponse.json(updated)
  }

  // First time setting — free, changedAt stays null
  const created = await prisma.userSeriesFanboy.create({
    data: { userId: session.user.id, series, teamId: Number(teamId) },
    include: { team: true },
  })
  return NextResponse.json(created)
}
