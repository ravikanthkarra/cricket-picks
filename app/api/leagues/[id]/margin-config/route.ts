import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_MARGIN_CONFIG, type MarginConfig } from '@/lib/marginConfig'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leagueId = parseInt(params.id)
  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })

  const isLeagueAdmin = league.adminId === session.user.id
  const isAppAdmin = session.user.role === 'admin'
  if (!isLeagueAdmin && !isAppAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: MarginConfig = await req.json()

  // Validate structure — each key must be a known margin type with numeric correct/wrong
  const validKeys = Object.keys(DEFAULT_MARGIN_CONFIG)
  for (const key of validKeys) {
    const rule = body[key]
    if (!rule || typeof rule.correct !== 'number' || typeof rule.wrong !== 'number') {
      return NextResponse.json({ error: `Invalid config for ${key}` }, { status: 400 })
    }
  }

  await prisma.league.update({
    where: { id: leagueId },
    data: { marginConfig: JSON.stringify(body) },
  })

  return NextResponse.json({ success: true })
}
