import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/leagues/[id]/fanboy
// Returns the current user's fanboy entry for this league
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leagueId = parseInt(params.id)
  const entry = await prisma.userLeagueFanboy.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
    include: { team: true },
  })
  return NextResponse.json(entry)
}

// PUT /api/leagues/[id]/fanboy
// Body: { teamId }
// Sets or changes fanboy team. Change allowed only once (changedAt tracks this).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leagueId = parseInt(params.id)

  // Verify user is a member of this league
  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: session.user.id } },
  })
  if (!membership) return NextResponse.json({ error: 'You are not a member of this league' }, { status: 403 })

  const { teamId } = await req.json()
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 })

  const team = await prisma.team.findUnique({ where: { id: Number(teamId) } })
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const existing = await prisma.userLeagueFanboy.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  })

  if (existing) {
    if (existing.changedAt) {
      return NextResponse.json(
        { error: 'You have already used your one allowed change for this league.' },
        { status: 403 }
      )
    }
    // First change — allow, set changedAt
    const updated = await prisma.userLeagueFanboy.update({
      where: { userId_leagueId: { userId: session.user.id, leagueId } },
      data: { teamId: Number(teamId), changedAt: new Date() },
      include: { team: true },
    })
    return NextResponse.json(updated)
  }

  // First time setting — free, changedAt stays null
  const created = await prisma.userLeagueFanboy.create({
    data: { userId: session.user.id, leagueId, teamId: Number(teamId) },
    include: { team: true },
  })
  return NextResponse.json(created)
}
