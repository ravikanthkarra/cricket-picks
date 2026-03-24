import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { JoinLeagueForm } from '@/components/JoinLeagueForm'

export const dynamic = 'force-dynamic'

export default async function LeaguesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

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

  const leagues = memberships.map(m => m.league)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Leagues</h1>
        <Link href="/leagues/new"
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded text-sm">
          + Create League
        </Link>
      </div>

      {leagues.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">You haven&apos;t joined any leagues yet.</p>
          <p className="text-sm">Create one or enter an invite code below.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {leagues.map(league => (
            <Link key={league.id} href={`/leagues/${league.id}`}
              className="bg-white border border-gray-200 hover:border-blue-500/50 rounded-xl p-5 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h2 className="font-bold text-lg text-gray-900">{league.name}</h2>
                {league.adminId === session.user.id && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">Admin</span>
                )}
              </div>
              {league.description && (
                <p className="text-gray-500 text-sm mb-3">{league.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{league._count.members} member{league._count.members !== 1 ? 's' : ''}</span>
                <span>by {league.admin.displayName || league.admin.username}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-lg font-semibold mb-4">Join a League</h2>
        <JoinLeagueForm />
      </div>
    </div>
  )
}
