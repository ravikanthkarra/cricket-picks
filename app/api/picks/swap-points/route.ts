import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { matchIdA, matchIdB } = await req.json()
  if (!matchIdA || !matchIdB || matchIdA === matchIdB) {
    return NextResponse.json({ error: 'Two different match IDs required' }, { status: 400 })
  }

  const [matchA, matchB] = await Promise.all([
    prisma.match.findUnique({ where: { id: Number(matchIdA) } }),
    prisma.match.findUnique({ where: { id: Number(matchIdB) } }),
  ])
  if (!matchA || !matchB) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  if (matchA.weekNumber !== matchB.weekNumber) {
    return NextResponse.json({ error: 'Both matches must be in the same week' }, { status: 400 })
  }

  const now = new Date()
  if (new Date(matchA.lockTime) <= now) return NextResponse.json({ error: `${matchA.matchNumber} is already locked` }, { status: 403 })
  if (new Date(matchB.lockTime) <= now) return NextResponse.json({ error: `Match ${matchB.matchNumber} is already locked` }, { status: 403 })

  const [pickA, pickB] = await Promise.all([
    prisma.pick.findUnique({ where: { userId_matchId: { userId: session.user.id, matchId: Number(matchIdA) } } }),
    prisma.pick.findUnique({ where: { userId_matchId: { userId: session.user.id, matchId: Number(matchIdB) } } }),
  ])
  if (!pickA?.points) return NextResponse.json({ error: 'No points set on first match' }, { status: 400 })
  if (!pickB?.points) return NextResponse.json({ error: 'No points set on second match' }, { status: 400 })

  // Atomic swap: set A to null first to avoid unique conflict, then swap
  await prisma.$transaction([
    prisma.pick.update({ where: { id: pickA.id }, data: { points: null } }),
    prisma.pick.update({ where: { id: pickB.id }, data: { points: pickA.points } }),
    prisma.pick.update({ where: { id: pickA.id }, data: { points: pickB.points } }),
  ])

  return NextResponse.json({ pointsA: pickB.points, pointsB: pickA.points })
}
