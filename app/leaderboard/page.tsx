import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage({ searchParams }: { searchParams: { series?: string } }) {
  const session = await auth()

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
    overallMap[pick.userId].totalPoints += conf + marg
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
    weekMap[week][pick.userId].points += conf + marg
  }
  const weeks = Object.keys(weekMap).map(Number).sort((a, b) => a - b)


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

    </div>
  )
}
