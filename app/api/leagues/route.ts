import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // removed ambiguous chars
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.leagueMember.findMany({
    where: { userId: session.user.id },
    include: {
      league: {
        include: {
          admin: { select: { username: true, displayName: true } },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  // Also include leagues the user admins (in case they haven't joined as member)
  const adminLeagues = await prisma.league.findMany({
    where: { adminId: session.user.id },
    include: {
      admin: { select: { username: true, displayName: true } },
      _count: { select: { members: true } },
    },
  })

  const memberLeagueIds = new Set(memberships.map(m => m.leagueId))
  const combined = [
    ...memberships.map(m => m.league),
    ...adminLeagues.filter(l => !memberLeagueIds.has(l.id)),
  ]

  return NextResponse.json(combined)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, rules, series } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'League name is required' }, { status: 400 })
  if (!series?.trim()) return NextResponse.json({ error: 'Series is required' }, { status: 400 })

  // Generate a unique invite code
  let inviteCode = generateInviteCode()
  let attempts = 0
  while (attempts < 10) {
    const existing = await prisma.league.findUnique({ where: { inviteCode } })
    if (!existing) break
    inviteCode = generateInviteCode()
    attempts++
  }

  const league = await prisma.league.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      rules: rules?.trim() || null,
      series: series.trim(),
      inviteCode,
      adminId: session.user.id,
      members: {
        create: { userId: session.user.id }, // creator auto-joins
      },
    },
  })

  return NextResponse.json(league, { status: 201 })
}
