import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leagueId = parseInt(params.id)
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      admin: { select: { id: true, username: true, displayName: true } },
      members: {
        include: { user: { select: { id: true, username: true, displayName: true } } },
      },
    },
  })

  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })

  // Check membership (app admin can view any league)
  const isMember = league.members.some(m => m.userId === session.user.id)
  const isAppAdmin = session.user.role === 'admin'
  if (!isMember && !isAppAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(league)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leagueId = parseInt(params.id)
  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })

  const isLeagueAdmin = league.adminId === session.user.id
  const isAppAdmin = session.user.role === 'admin'
  if (!isLeagueAdmin && !isAppAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description, rules, fanboyPoints } = await req.json()
  const updated = await prisma.league.update({
    where: { id: leagueId },
    data: {
      name: name?.trim() || league.name,
      description: description?.trim() ?? league.description,
      rules: rules?.trim() ?? league.rules,
      ...(fanboyPoints !== undefined && { fanboyPoints: Number(fanboyPoints) }),
    },
  })

  return NextResponse.json(updated)
}
