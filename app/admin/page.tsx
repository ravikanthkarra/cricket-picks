import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminMatchList } from '@/components/AdminMatchList'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') redirect('/')

  const matches = await prisma.match.findMany({
    include: { homeTeam: true, awayTeam: true, winningTeam: true },
    orderBy: [{ weekNumber: 'asc' }, { scheduledAt: 'asc' }],
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Admin Panel</h1>
      <p className="text-gray-500 mb-8">Set match results to update the leaderboard.</p>
      <AdminMatchList matches={matches} />
    </div>
  )
}
