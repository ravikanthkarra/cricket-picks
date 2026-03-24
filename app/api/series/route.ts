import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await prisma.match.findMany({
    select: { series: true },
    distinct: ['series'],
    orderBy: { series: 'asc' },
  })
  return NextResponse.json(rows.map(r => r.series))
}
