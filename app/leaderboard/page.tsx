import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { parseMarginConfig, calcMarginPoints, calcConfPoints } from '@/lib/marginConfig'
import { TeamBadge } from '@/components/TeamBadge'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Leagues the current user belongs to
  const memberships = await prisma.leagueMember.findMany({
    where: { userId: session.user.id },
    include: {
      league: {
        include: {
          admin: { select: { username: true, displayName: true } },
          members: { select: { userId: true } },
        },
      },
    },
  })

  if (memberships.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-gray-500">You are not in any league yet.</p>
        <Link href="/leagues" className="inline-block mt-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded">
          Browse Leagues
        </Link>
      </div>
    )
  }

  // Build standings for each league
  const leagueStandings = await Promise.all(
    memberships.map(async ({ league }) => {
      const marginConfig = parseMarginConfig(league.marginConfig)
      const memberUserIds = league.members.map(m => m.userId)

      const picks = await prisma.pick.findMany({
        where: { userId: { in: memberUserIds }, isCorrect: { not: null }, match: { series: league.series } },
        include: {
          match: { select: { weekNumber: true, margin: true, status: true, homeTeamId: true, awayTeamId: true } },
          user: { select: { id: true, username: true, displayName: true } },
        },
      })

      const fanboyEntries = await prisma.userLeagueFanboy.findMany({
        where: { leagueId: league.id },
        include: { team: { select: { id: true, shortName: true, primaryColor: true, logoUrl: true } } },
      })
      const fanboyTeamByUser: Record<string, number> = {}
      const fanboyTeamInfoByUser: Record<string, { id: number; shortName: string; primaryColor: string; logoUrl: string | null }> = {}
      for (const f of fanboyEntries) {
        fanboyTeamByUser[f.userId] = f.teamId
        fanboyTeamInfoByUser[f.userId] = f.team
      }

      // Overall score map
      const scoreMap: Record<string, { totalPoints: number; totalPicks: number; username: string; displayName: string | null }> = {}
      const weekMap: Record<number, Record<string, { points: number; username: string; displayName: string | null }>> = {}

      for (const pick of picks) {
        const conf = calcConfPoints(pick.points, pick.isCorrect, pick.match.status)
        const marg = calcMarginPoints(pick.marginPick, pick.match.margin, pick.isCorrect!, marginConfig)
        const fanboyTeamId = fanboyTeamByUser[pick.userId]
        const fanboy = pick.match.status === 'no_result'
          ? (fanboyTeamId && (fanboyTeamId === pick.match.homeTeamId || fanboyTeamId === pick.match.awayTeamId) ? 1 : 0)
          : (fanboyTeamId === pick.pickedTeamId && pick.isCorrect ? league.fanboyPoints : 0)
        const pts = conf + marg + fanboy
        const week = pick.match.weekNumber

        if (!scoreMap[pick.userId]) {
          scoreMap[pick.userId] = { totalPoints: 0, totalPicks: 0, username: pick.user.username, displayName: pick.user.displayName }
        }
        scoreMap[pick.userId].totalPoints += pts
        scoreMap[pick.userId].totalPicks += 1

        if (!weekMap[week]) weekMap[week] = {}
        if (!weekMap[week][pick.userId]) {
          weekMap[week][pick.userId] = { points: 0, username: pick.user.username, displayName: pick.user.displayName }
        }
        weekMap[week][pick.userId].points += pts
      }

      // Include members with zero picks
      for (const m of league.members) {
        if (!scoreMap[m.userId]) {
          const user = await prisma.user.findUnique({ where: { id: m.userId }, select: { id: true, username: true, displayName: true } })
          if (user) scoreMap[m.userId] = { totalPoints: 0, totalPicks: 0, username: user.username, displayName: user.displayName }
        }
      }

      const overall = Object.entries(scoreMap)
        .map(([userId, s]) => ({ userId, ...s }))
        .sort((a, b) => b.totalPoints - a.totalPoints || a.totalPicks - b.totalPicks)

      const weeks = Object.keys(weekMap).map(Number).sort((a, b) => a - b)

      return { league, overall, weekMap, weeks, fanboyTeamInfoByUser }
    })
  )

  return (
    <div className="space-y-12">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

      {leagueStandings.map(({ league, overall, weekMap, weeks, fanboyTeamInfoByUser }) => (
        <div key={league.id} className="space-y-6">
          {/* League header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{league.name}</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {league.series} · {league.members.length} member{league.members.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link href={`/leagues/${league.id}`}
              className="text-sm text-blue-600 hover:underline">
              View League →
            </Link>
          </div>

          {/* Overall standings */}
          {overall.length === 0 ? (
            <p className="text-gray-400 text-sm">No results yet.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Overall Standings</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Fanboy / Player</th>
                    <th className="px-4 py-3 text-right">Points</th>
                    <th className="px-4 py-3 text-right">Picks</th>
                  </tr>
                </thead>
                <tbody>
                  {overall.map((entry, i) => {
                    const isMe = session.user.id === entry.userId
                    return (
                      <tr key={entry.userId}
                        className={`border-b border-gray-200 last:border-0 ${isMe ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3 text-gray-500 font-mono">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {fanboyTeamInfoByUser[entry.userId] && (
                              <span title={`Fanboy: ${fanboyTeamInfoByUser[entry.userId].shortName}`}>
                                <TeamBadge
                                  shortName={fanboyTeamInfoByUser[entry.userId].shortName}
                                  primaryColor={fanboyTeamInfoByUser[entry.userId].primaryColor}
                                  logoUrl={fanboyTeamInfoByUser[entry.userId].logoUrl}
                                  size="sm"
                                />
                              </span>
                            )}
                            <span className="font-medium">{entry.displayName || entry.username}</span>
                            {isMe && <span className="ml-1 text-xs text-blue-600">(you)</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-blue-600 font-bold">{entry.totalPoints}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{entry.totalPicks}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Weekly standings */}
          {weeks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Weekly Standings</h3>
              <div className="space-y-4">
                {weeks.map(week => {
                  const weekEntries = Object.entries(weekMap[week])
                    .map(([userId, s]) => ({ userId, ...s }))
                    .sort((a, b) => b.points - a.points)
                  const topScore = weekEntries[0]?.points ?? 0
                  return (
                    <div key={week} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <span className="font-semibold text-gray-800 text-sm">Week {week}</span>
                        {weekEntries[0] && (
                          <span className="text-xs text-gray-400">
                            Leader: <span className="text-blue-600 font-medium">{weekEntries[0].displayName || weekEntries[0].username}</span> · {topScore} pts
                          </span>
                        )}
                      </div>
                      <table className="w-full">
                        <tbody>
                          {weekEntries.map((entry, i) => {
                            const isMe = session.user.id === entry.userId
                            return (
                              <tr key={entry.userId}
                                className={`border-b border-gray-100 last:border-0 ${isMe ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                <td className="px-4 py-2.5 text-gray-400 text-sm w-10">
                                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                </td>
                                <td className="px-2 py-2.5 text-sm">
                                  <span className="font-medium">{entry.displayName || entry.username}</span>
                                  {isMe && <span className="ml-2 text-xs text-blue-600">(you)</span>}
                                </td>
                                <td className="px-4 py-2.5 text-right text-blue-600 font-bold text-sm">{entry.points}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
