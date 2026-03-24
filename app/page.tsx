import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { TeamBadge } from '@/components/TeamBadge'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await auth()

  const now = new Date()
  const upcomingMatches = await prisma.match.findMany({
    where: { status: 'upcoming', scheduledAt: { gte: now } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { scheduledAt: 'asc' },
    take: 5,
  })

  const leaderboard = await prisma.leaderboardEntry.findMany({
    include: { user: { select: { username: true, displayName: true } } },
    orderBy: [{ totalCorrect: 'desc' }],
    take: 5,
  })

  const currentWeek = upcomingMatches[0]?.weekNumber ?? 1

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center py-10">
        <h1 className="text-4xl font-bold text-blue-600 mb-3">IPL 2026 Picks Challenge</h1>
        <p className="text-gray-500 text-lg mb-6">Pick the winners. Climb the leaderboard. Bragging rights await.</p>
        {session ? (
          <Link href={`/picks?week=${currentWeek}`}
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-lg text-lg">
            Make Your Picks
          </Link>
        ) : (
          <div className="flex gap-4 justify-center">
            <Link href="/register" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-lg text-lg">
              Join the Challenge
            </Link>
            <Link href="/login" className="border border-gray-400 hover:border-gray-500 px-8 py-3 rounded-lg text-lg">
              Sign In
            </Link>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Upcoming Matches */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Upcoming Matches</h2>
          <div className="space-y-3">
            {upcomingMatches.length === 0 && <p className="text-gray-400">No upcoming matches.</p>}
            {upcomingMatches.map(match => (
              <div key={match.id} className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamBadge shortName={match.homeTeam.shortName} primaryColor={match.homeTeam.primaryColor} logoUrl={match.homeTeam.logoUrl} size="sm" />
                    <span className="font-semibold text-sm"
                      style={{ color: match.homeTeam.primaryColor }}>
                      {match.homeTeam.shortName}
                    </span>
                    <span className="text-gray-400 text-xs">vs</span>
                    <TeamBadge shortName={match.awayTeam.shortName} primaryColor={match.awayTeam.primaryColor} logoUrl={match.awayTeam.logoUrl} size="sm" />
                    <span className="font-semibold text-sm"
                      style={{ color: match.awayTeam.primaryColor }}>
                      {match.awayTeam.shortName}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500 text-xs">
                      {new Date(match.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-gray-400 text-xs">{match.venue.split(',')[0]}</div>
                  </div>
                </div>
              </div>
            ))}
            <Link href="/matches" className="block text-center text-blue-600 hover:text-blue-500 text-sm mt-2">
              View full schedule
            </Link>
          </div>
        </div>

        {/* Mini Leaderboard */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Top Pickers</h2>
          {leaderboard.length === 0 ? (
            <p className="text-gray-400">No picks recorded yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                  <span className="text-gray-400 w-6 text-center font-bold">{i + 1}</span>
                  <span className="flex-1 font-medium">{entry.user.displayName || entry.user.username}</span>
                  <span className="text-blue-600 font-bold">{entry.totalCorrect}</span>
                  <span className="text-gray-400 text-sm">/ {entry.totalPicks}</span>
                </div>
              ))}
              <Link href="/leaderboard" className="block text-center text-blue-600 hover:text-blue-500 text-sm mt-2">
                Full leaderboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
