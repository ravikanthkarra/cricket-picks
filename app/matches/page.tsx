import { prisma } from '@/lib/prisma'
import { TeamBadge } from '@/components/TeamBadge'

export const dynamic = 'force-dynamic'

export default async function MatchesPage({ searchParams }: { searchParams: { series?: string } }) {
  const allSeries = await prisma.match.findMany({
    select: { series: true },
    distinct: ['series'],
    orderBy: { series: 'asc' },
  })
  const seriesList = allSeries.map(s => s.series)
  const selectedSeries = searchParams.series ?? seriesList[0] ?? 'IPL 2026'

  const matches = await prisma.match.findMany({
    where: { series: selectedSeries },
    include: { homeTeam: true, awayTeam: true, winningTeam: true },
    orderBy: [{ weekNumber: 'asc' }, { scheduledAt: 'asc' }],
  })

  // Group by week
  const byWeek: Record<number, typeof matches> = {}
  for (const m of matches) {
    if (!byWeek[m.weekNumber]) byWeek[m.weekNumber] = []
    byWeek[m.weekNumber].push(m)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Schedule</h1>

      {/* Series tabs */}
      {seriesList.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {seriesList.map(s => (
            <a key={s} href={`/matches?series=${encodeURIComponent(s)}`}
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

      {Object.entries(byWeek).map(([week, weekMatches]) => (
        <div key={week} className="mb-10">
          <h2 className="text-lg font-semibold text-blue-600 mb-4">Week {week}</h2>
          <div className="space-y-3">
            {weekMatches.map(match => (
              <div key={match.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-gray-500 text-xs w-12">M{match.matchNumber}</span>
                  <div className="flex items-center gap-3">
                    <TeamBadge shortName={match.homeTeam.shortName} primaryColor={match.homeTeam.primaryColor} logoUrl={match.homeTeam.logoUrl} size="sm" />
                    <span className="font-bold text-sm" style={{ color: match.homeTeam.primaryColor }}>
                      {match.homeTeam.shortName}
                    </span>
                    <span className="text-gray-400 text-xs px-1">vs</span>
                    <TeamBadge shortName={match.awayTeam.shortName} primaryColor={match.awayTeam.primaryColor} logoUrl={match.awayTeam.logoUrl} size="sm" />
                    <span className="font-bold text-sm" style={{ color: match.awayTeam.primaryColor }}>
                      {match.awayTeam.shortName}
                    </span>
                  </div>
                  {match.status === 'completed' && match.winningTeam && (
                    <span className="text-xs text-green-600 ml-1">
                      {match.winningTeam.shortName} won
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-gray-500 text-sm">
                    {new Date(match.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-gray-400 text-xs">{match.venue.split(',')[0]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
