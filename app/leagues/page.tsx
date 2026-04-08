import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { JoinLeagueForm } from '@/components/JoinLeagueForm'
import { parseMarginConfig, calcMarginPoints, calcConfPoints } from '@/lib/marginConfig'
import { TeamBadge } from '@/components/TeamBadge'

export const dynamic = 'force-dynamic'

export default async function LeaguesPage({ searchParams }: { searchParams: { week?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const memberships = await prisma.leagueMember.findMany({
    where: { userId: session.user.id },
    include: {
      league: {
        include: {
          admin: { select: { id: true, username: true, displayName: true } },
          members: { select: { userId: true } },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  const now = new Date()

  // All distinct weeks that have started matches
  const startedWeekRows = await prisma.match.findMany({
    where: { scheduledAt: { lte: now } },
    select: { weekNumber: true },
    distinct: ['weekNumber'],
    orderBy: { weekNumber: 'asc' },
  })
  const startedWeeks = startedWeekRows.map(r => r.weekNumber)

  // Current week: week of the next upcoming match; fallback to latest started week
  const nextMatch = await prisma.match.findFirst({
    where: { scheduledAt: { gt: now } },
    orderBy: { scheduledAt: 'asc' },
    select: { weekNumber: true },
  })
  const currentWeek = nextMatch?.weekNumber ?? startedWeeks[startedWeeks.length - 1] ?? 1
  const selectedWeek = parseInt(searchParams.week ?? String(currentWeek))

  const leagueData = await Promise.all(
    memberships.map(async ({ league }) => {
      const memberUserIds = league.members.map(m => m.userId)
      const marginConfig = parseMarginConfig(league.marginConfig)

      const fanboyEntries = await prisma.userLeagueFanboy.findMany({
        where: { leagueId: league.id },
        select: { userId: true, teamId: true },
      })
      const fanboyTeamByUser: Record<string, number> = {}
      for (const f of fanboyEntries) fanboyTeamByUser[f.userId] = f.teamId

      const weekMatches = await prisma.match.findMany({
        where: { series: league.series, scheduledAt: { lte: now }, weekNumber: selectedWeek },
        include: {
          homeTeam: true,
          awayTeam: true,
          winningTeam: true,
          picks: {
            where: { userId: { in: memberUserIds } },
            include: {
              user: { select: { id: true, username: true, displayName: true } },
              pickedTeam: true,
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
      })

      return { league, marginConfig, fanboyTeamByUser, weekMatches }
    })
  )

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">All Players Picks</h1>

      {memberships.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">You haven&apos;t joined any leagues yet.</p>
          <p className="text-sm">Create one or enter an invite code below.</p>
        </div>
      ) : (
        <>
          {/* Week tabs */}
          {startedWeeks.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {startedWeeks.map(week => (
                <a key={week} href={`/leagues?week=${week}`}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    week === selectedWeek
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}>
                  Week {week}
                </a>
              ))}
            </div>
          )}

          <div className="space-y-10">
            {leagueData.map(({ league, marginConfig, fanboyTeamByUser, weekMatches }) => (
              <div key={league.id} className="space-y-4">
                {/* League header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{league.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {league.series} · {league.members.length} member{league.members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Link href={`/leagues/${league.id}`} className="text-sm text-blue-600 hover:underline">
                    League Settings →
                  </Link>
                </div>

                {weekMatches.length === 0 ? (
                  <p className="text-sm text-gray-400">No matches started yet for Week {selectedWeek}.</p>
                ) : (
                  <div className="space-y-3">
                    {weekMatches.map(match => {
                      const isCompleted = match.status === 'completed'
                      const isNoResult = match.status === 'no_result'
                      return (
                        <div key={match.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <span className="text-gray-500 text-xs">M{match.matchNumber}</span>
                              <TeamBadge shortName={match.homeTeam.shortName} primaryColor={match.homeTeam.primaryColor} logoUrl={match.homeTeam.logoUrl} size="sm" />
                              <span>{match.homeTeam.shortName}</span>
                              <span className="text-gray-400 font-normal">vs</span>
                              <TeamBadge shortName={match.awayTeam.shortName} primaryColor={match.awayTeam.primaryColor} logoUrl={match.awayTeam.logoUrl} size="sm" />
                              <span>{match.awayTeam.shortName}</span>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              isCompleted ? 'bg-green-100 text-green-700' : isNoResult ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {isCompleted ? `${match.winningTeam?.shortName ?? '?'} won` : isNoResult ? 'No Result' : 'In progress'}
                            </span>
                          </div>

                          {match.picks.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-gray-400">No picks submitted.</p>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {match.picks.map(pick => {
                                const isMe = session.user.id === pick.user.id
                                const correct = isCompleted && pick.isCorrect
                                const wrong = isCompleted && pick.isCorrect === false
                                const pickFanboyTeamId = fanboyTeamByUser[pick.userId]
                                const isFanboy = pickFanboyTeamId === pick.pickedTeamId
                                const fanboyInMatch = pickFanboyTeamId === match.homeTeam.id || pickFanboyTeamId === match.awayTeam.id

                                const isSettled = isCompleted || isNoResult
                                let breakdown: string | null = null
                                let totalPts: number | null = null
                                if (isSettled && pick.isCorrect !== null) {
                                  const conf = calcConfPoints(pick.points, pick.isCorrect, match.status)
                                  const marg = isNoResult ? 0 : calcMarginPoints(pick.marginPick, match.margin, pick.isCorrect, marginConfig)
                                  const fanboyPts = isNoResult
                                    ? (fanboyInMatch ? 1 : 0)
                                    : (isFanboy && pick.isCorrect ? league.fanboyPoints : 0)
                                  totalPts = conf + marg + fanboyPts
                                  if (isNoResult) {
                                    breakdown = `No Result — Pick ${conf} (½ pts)${fanboyPts ? ' + Fanboy 1' : ''}`
                                  } else if (!pick.isCorrect) {
                                    breakdown = '0 pts'
                                  } else {
                                    let bd = `Pick ${conf}`
                                    if (marg > 0) bd += ` + Margin Bonus ${marg}`
                                    else if (marg < 0) bd += ` - Margin Penalty ${Math.abs(marg)}`
                                    if (fanboyPts > 0) bd += ` + Fanboy Team ${fanboyPts}`
                                    breakdown = bd
                                  }
                                }

                                return (
                                  <div key={pick.id}
                                    className={`px-4 py-2.5 flex items-center justify-between text-sm ${isMe ? 'bg-blue-50' : ''}`}>
                                    <span className="text-gray-700">
                                      {pick.user.displayName || pick.user.username}
                                      {isMe && <span className="ml-1 text-xs text-blue-600">(you)</span>}
                                    </span>
                                    <div className="flex flex-col items-end gap-0.5">
                                      <div className="flex items-center gap-1.5">
                                        {totalPts !== null && (
                                          <span className="font-bold text-blue-600">{totalPts}</span>
                                        )}
                                        {(isNoResult ? fanboyInMatch : isFanboy) && (
                                          <span title="Fanboy team" className="text-amber-400 text-xs">⭐</span>
                                        )}
                                        <TeamBadge
                                          shortName={pick.pickedTeam.shortName}
                                          primaryColor={pick.pickedTeam.primaryColor}
                                          logoUrl={pick.pickedTeam.logoUrl}
                                          size="sm"
                                        />
                                        <span className={`font-medium ${
                                          correct ? 'text-green-600' : wrong ? 'text-red-500' : 'text-gray-700'
                                        }`}>
                                          {pick.pickedTeam.shortName}
                                          {correct && ' ✓'}
                                          {wrong && ' ✗'}
                                        </span>
                                      </div>
                                      {breakdown && (
                                        <span className="text-xs text-gray-400">{breakdown}</span>
                                      )}
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
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-lg font-semibold mb-4">Join a League</h2>
        <JoinLeagueForm />
      </div>
    </div>
  )
}
