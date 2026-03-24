import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage({ searchParams }: { searchParams: { series?: string } }) {
  const session = await auth()
  const now = new Date()

  // All available series
  const allSeries = await prisma.match.findMany({
    select: { series: true },
    distinct: ['series'],
    orderBy: { series: 'asc' },
  })
  const seriesList = allSeries.map(s => s.series)
  const selectedSeries = searchParams.series ?? seriesList[0] ?? 'IPL 2026'

  // All picks for completed matches in this series
  const picks = await prisma.pick.findMany({
    where: { isCorrect: { not: null }, match: { series: selectedSeries } },
    include: {
      match: { select: { weekNumber: true } },
      user: { select: { id: true, username: true, displayName: true } },
    },
  })

  // --- Overall standings ---
  const overallMap: Record<string, { totalPoints: number; totalPicks: number; username: string; displayName: string | null }> = {}
  for (const pick of picks) {
    if (!overallMap[pick.userId]) {
      overallMap[pick.userId] = { totalPoints: 0, totalPicks: 0, username: pick.user.username, displayName: pick.user.displayName }
    }
    const conf = pick.isCorrect ? (pick.points ?? 1) : 0
    const marg = pick.marginPoints ?? 0
    const fanboy = pick.fanboyPoints ?? 0
    overallMap[pick.userId].totalPoints += conf + marg + fanboy
    overallMap[pick.userId].totalPicks += 1
  }
  const overallEntries = Object.entries(overallMap)
    .map(([userId, s]) => ({ userId, ...s }))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.totalPicks - b.totalPicks)

  // --- Weekly standings ---
  const weekMap: Record<number, Record<string, { points: number; username: string; displayName: string | null }>> = {}
  for (const pick of picks) {
    const week = pick.match.weekNumber
    if (!weekMap[week]) weekMap[week] = {}
    if (!weekMap[week][pick.userId]) {
      weekMap[week][pick.userId] = { points: 0, username: pick.user.username, displayName: pick.user.displayName }
    }
    const conf = pick.isCorrect ? (pick.points ?? 1) : 0
    const marg = pick.marginPoints ?? 0
    const fanboy = pick.fanboyPoints ?? 0
    weekMap[week][pick.userId].points += conf + marg + fanboy
  }
  const weeks = Object.keys(weekMap).map(Number).sort((a, b) => a - b)

  // --- Started matches for this series (for Match Picks section) ---
  const startedMatches = await prisma.match.findMany({
    where: { lockTime: { lte: now }, series: selectedSeries },
    include: {
      homeTeam: true,
      awayTeam: true,
      winningTeam: true,
      picks: {
        include: {
          user: { select: { id: true, username: true, displayName: true } },
          pickedTeam: true,
        },
      },
    },
    orderBy: [{ weekNumber: 'asc' }, { scheduledAt: 'asc' }],
  })

  const matchesByWeek: Record<number, typeof startedMatches> = {}
  for (const match of startedMatches) {
    if (!matchesByWeek[match.weekNumber]) matchesByWeek[match.weekNumber] = []
    matchesByWeek[match.weekNumber].push(match)
  }
  const startedWeeks = Object.keys(matchesByWeek).map(Number).sort((a, b) => a - b)

  return (
    <div className="space-y-10">

      {/* Series tabs */}
      {seriesList.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {seriesList.map(s => (
            <a key={s} href={`/leaderboard?series=${encodeURIComponent(s)}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                s === selectedSeries
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}>
              {s}
            </a>
          ))}
        </div>
      )}

      {/* Overall standings */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Leaderboard</h1>
        <p className="text-sm text-gray-400 mb-5">{selectedSeries} · Overall standings</p>
        {overallEntries.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            No results yet. Standings will appear once matches are completed.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3 text-right">Points</th>
                  <th className="px-4 py-3 text-right">Picks</th>
                </tr>
              </thead>
              <tbody>
                {overallEntries.map((entry, i) => {
                  const isMe = session?.user?.id === entry.userId
                  return (
                    <tr key={entry.userId}
                      className={`border-b border-gray-200 last:border-0 ${isMe ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 text-gray-500 font-mono">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{entry.displayName || entry.username}</span>
                        {isMe && <span className="ml-2 text-xs text-blue-600">(you)</span>}
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
      </div>

      {/* Weekly standings */}
      {weeks.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-5">Weekly Standings</h2>
          <div className="space-y-5">
            {weeks.map(week => {
              const weekEntries = Object.entries(weekMap[week])
                .map(([userId, s]) => ({ userId, ...s }))
                .sort((a, b) => b.points - a.points)
              const topScore = weekEntries[0]?.points ?? 0

              return (
                <div key={week} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="font-semibold text-gray-800">Week {week}</span>
                    {weekEntries[0] && (
                      <span className="text-xs text-gray-400">
                        Leader: <span className="text-blue-600 font-medium">{weekEntries[0].displayName || weekEntries[0].username}</span> · {topScore} pts
                      </span>
                    )}
                  </div>
                  <table className="w-full">
                    <tbody>
                      {weekEntries.map((entry, i) => {
                        const isMe = session?.user?.id === entry.userId
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

      {/* Match picks — revealed after match starts */}
      {startedMatches.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-2">Match Picks</h2>
          <p className="text-sm text-gray-500 mb-5">Picks are revealed once a match starts.</p>
          <div className="space-y-8">
            {startedWeeks.map(week => (
              <div key={week}>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Week {week}</h3>
                <div className="space-y-4">
                  {matchesByWeek[week].map(match => {
                    const isCompleted = match.status === 'completed'
                    return (
                      <div key={match.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {match.homeTeam.shortName} vs {match.awayTeam.shortName}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            isCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {isCompleted ? `${match.winningTeam?.shortName ?? '?'} won` : 'In progress'}
                          </span>
                        </div>
                        {match.picks.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-gray-400">No picks submitted.</p>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {match.picks.map(pick => {
                              const isMe = session?.user?.id === pick.user.id
                              const correct = isCompleted && pick.isCorrect
                              const wrong = isCompleted && pick.isCorrect === false
                              return (
                                <div key={pick.id}
                                  className={`px-4 py-2 flex items-center justify-between text-sm ${isMe ? 'bg-blue-50' : ''}`}>
                                  <span className="text-gray-700">
                                    {pick.user.displayName || pick.user.username}
                                    {isMe && <span className="ml-1 text-xs text-blue-600">(you)</span>}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {pick.points && (
                                      <span className="text-xs text-gray-400">{pick.points}pt</span>
                                    )}
                                    <span className={`font-medium ${
                                      correct ? 'text-green-600' : wrong ? 'text-red-500' : 'text-gray-700'
                                    }`}>
                                      {pick.pickedTeam.shortName}
                                      {correct && ' ✓'}
                                      {wrong && ' ✗'}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
