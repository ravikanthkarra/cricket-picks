import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PicksWeekView } from '@/components/PicksWeekView'

export const dynamic = 'force-dynamic'

export default async function PicksPage({ searchParams }: { searchParams: { week?: string; series?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const allSeries = await prisma.match.findMany({
    select: { series: true },
    distinct: ['series'],
    orderBy: { series: 'asc' },
  })
  const seriesList = allSeries.map(s => s.series)
  const selectedSeries = searchParams.series ?? seriesList[0] ?? 'IPL 2026'

  const weeks = await prisma.match.findMany({
    where: { series: selectedSeries },
    select: { weekNumber: true },
    distinct: ['weekNumber'],
    orderBy: { weekNumber: 'asc' },
  })
  const weekNumbers = weeks.map(w => w.weekNumber)

  // Default to current week: week of the next upcoming match; fallback to last week
  const now = new Date()
  const nextMatch = await prisma.match.findFirst({
    where: { series: selectedSeries, scheduledAt: { gt: now } },
    orderBy: { scheduledAt: 'asc' },
    select: { weekNumber: true },
  })
  const currentWeek = nextMatch?.weekNumber ?? weekNumbers[weekNumbers.length - 1] ?? 1
  const selectedWeek = parseInt(searchParams.week ?? String(currentWeek))

  const matches = await prisma.match.findMany({
    where: { weekNumber: selectedWeek, series: selectedSeries },
    include: { homeTeam: true, awayTeam: true, winningTeam: true },
    orderBy: { scheduledAt: 'asc' },
  })

  const userPicks = await prisma.pick.findMany({
    where: { userId: session.user.id, match: { weekNumber: selectedWeek, series: selectedSeries } },
  })

  const picksMap: Record<number, number> = {}
  const pointsMap: Record<number, number> = {}
  const marginPickMap: Record<number, string> = {}
  userPicks.forEach(p => {
    picksMap[p.matchId] = p.pickedTeamId
    if (p.points) pointsMap[p.matchId] = p.points
    if (p.marginPick) marginPickMap[p.matchId] = p.marginPick
  })


  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">My Picks</h1>
      <p className="text-gray-500 text-sm mb-4">
        Assign confidence points to each pick — higher points on matches you're most confident about.
        Each point value (1–{matches.length}) can only be used once per week.
      </p>

      {/* Series tabs */}
      {seriesList.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {seriesList.map(s => (
            <a key={s} href={`/picks?series=${encodeURIComponent(s)}`}
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

      {/* Week tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {weekNumbers.map(week => (
          <a key={week} href={`/picks?series=${encodeURIComponent(selectedSeries)}&week=${week}`}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              week === selectedWeek
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}>
            Week {week}
          </a>
        ))}
      </div>
      <PicksWeekView
        matches={matches}
        picksMap={picksMap}
        pointsMap={pointsMap}
        marginPickMap={marginPickMap}
        weekMatchCount={matches.length}
      />
    </div>
  )
}
