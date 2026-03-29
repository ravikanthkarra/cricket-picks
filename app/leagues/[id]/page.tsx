import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { parseMarginConfig, calcMarginPoints } from '@/lib/marginConfig'
import { LeagueFanboyPicker } from '@/components/LeagueFanboyPicker'

export const dynamic = 'force-dynamic'

export default async function LeaguePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const leagueId = parseInt(params.id)
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      admin: { select: { id: true, username: true, displayName: true } },
      members: { select: { userId: true } },
    },
  })
  if (!league) notFound()

  const isMember = league.members.some(m => m.userId === session.user.id)
  const isAppAdmin = session.user.role === 'admin'
  if (!isMember && !isAppAdmin) redirect('/leagues')

  const isLeagueAdmin = league.adminId === session.user.id

  // Leaderboard: recalculate using this league's margin config + per-league fanboy
  const marginConfig = parseMarginConfig(league.marginConfig)
  const memberUserIds = league.members.map(m => m.userId)

  const memberPicks = await prisma.pick.findMany({
    where: { userId: { in: memberUserIds }, isCorrect: { not: null }, match: { series: league.series } },
    include: { match: { select: { margin: true } }, user: { select: { username: true, displayName: true } } },
  })

  // Per-league fanboy entries
  const fanboyEntries = await prisma.userLeagueFanboy.findMany({
    where: { leagueId },
    select: { userId: true, teamId: true },
  })
  const fanboyTeamByUser: Record<string, number> = {}
  for (const f of fanboyEntries) fanboyTeamByUser[f.userId] = f.teamId

  // Group by userId and calculate score
  const scoreMap: Record<string, { totalPoints: number; totalPicks: number; username: string; displayName: string | null }> = {}
  for (const pick of memberPicks) {
    if (!scoreMap[pick.userId]) {
      scoreMap[pick.userId] = { totalPoints: 0, totalPicks: 0, username: pick.user.username, displayName: pick.user.displayName }
    }
    const conf = pick.isCorrect ? (pick.points ?? 1) : 0
    const marg = calcMarginPoints(pick.marginPick, pick.match.margin, pick.isCorrect!, marginConfig)
    const isFanboy = fanboyTeamByUser[pick.userId] === pick.pickedTeamId
    const fanboy = isFanboy && pick.isCorrect ? league.fanboyPoints : 0
    scoreMap[pick.userId].totalPoints += conf + marg + fanboy
    scoreMap[pick.userId].totalPicks += 1
  }

  // Include members with zero picks too
  for (const m of league.members) {
    if (!scoreMap[m.userId]) {
      const user = await prisma.user.findUnique({ where: { id: m.userId }, select: { username: true, displayName: true } })
      if (user) scoreMap[m.userId] = { totalPoints: 0, totalPicks: 0, username: user.username, displayName: user.displayName }
    }
  }

  const entries = Object.entries(scoreMap)
    .map(([userId, s]) => ({ userId, ...s }))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.totalPicks - b.totalPicks)

  // Match Picks: started/completed matches in this league's series, with all member picks
  const now = new Date()
  const startedMatches = await prisma.match.findMany({
    where: { series: league.series, lockTime: { lte: now } },
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
    orderBy: [{ weekNumber: 'asc' }, { scheduledAt: 'asc' }],
  })

  const matchesByWeek: Record<number, typeof startedMatches> = {}
  for (const match of startedMatches) {
    if (!matchesByWeek[match.weekNumber]) matchesByWeek[match.weekNumber] = []
    matchesByWeek[match.weekNumber].push(match)
  }
  const startedWeeks = Object.keys(matchesByWeek).map(Number).sort((a, b) => a - b)

  // Current user's fanboy entry for the picker
  const myFanboyEntry = await prisma.userLeagueFanboy.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
    include: { team: true },
  })
  const myFanboyInitial = myFanboyEntry
    ? { teamId: myFanboyEntry.teamId, changedAt: myFanboyEntry.changedAt?.toISOString() ?? null, team: myFanboyEntry.team }
    : null

  // All teams for the picker
  const teams = await prisma.team.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, shortName: true, primaryColor: true, logoUrl: true },
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/leagues" className="text-gray-400 hover:text-gray-600 text-sm">← My Leagues</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{league.name}</h1>
          {league.description && <p className="text-gray-500 mt-1">{league.description}</p>}
          <p className="text-gray-400 text-sm mt-1">
            {league.members.length} member{league.members.length !== 1 ? 's' : ''} · Admin: {league.admin.displayName || league.admin.username}
          </p>
          <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">
            {league.series}
          </span>
        </div>
        {(isLeagueAdmin || isAppAdmin) && (
          <Link href={`/leagues/${leagueId}/admin`}
            className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-sm px-4 py-2 rounded font-medium">
            Manage League
          </Link>
        )}
      </div>

      {/* Rules */}
      {league.rules && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-blue-600 mb-2 uppercase tracking-wide">League Rules</h2>
          <p className="text-gray-600 text-sm whitespace-pre-wrap">{league.rules}</p>
        </div>
      )}

      {/* Fanboy Team Picker */}
      <LeagueFanboyPicker
        leagueId={leagueId}
        teams={teams}
        initial={myFanboyInitial}
      />

      {/* Standings */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Standings</h2>
        {entries.length === 0 ? (
          <p className="text-gray-400 text-center py-10">No results yet — standings will appear once matches are completed.</p>
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
                {entries.map((entry, i) => {
                  const isMe = session.user.id === entry.userId
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

      {/* Match Picks */}
      {startedMatches.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-1">Match Picks</h2>
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
                              const isMe = session.user.id === pick.user.id
                              const correct = isCompleted && pick.isCorrect
                              const wrong = isCompleted && pick.isCorrect === false
                              const isFanboy = fanboyTeamByUser[pick.userId] === pick.pickedTeamId

                              // Points breakdown for completed matches
                              let breakdown: string | null = null
                              let totalPts: number | null = null
                              if (isCompleted && pick.isCorrect !== null) {
                                const conf = pick.isCorrect ? (pick.points ?? 1) : 0
                                const marg = calcMarginPoints(pick.marginPick, match.margin, pick.isCorrect, marginConfig)
                                const fanboyPts = isFanboy && pick.isCorrect ? league.fanboyPoints : 0
                                totalPts = conf + marg + fanboyPts
                                if (!pick.isCorrect) {
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
                                      {isFanboy && (
                                        <span title="Fanboy team" className="text-amber-400 text-xs">⭐</span>
                                      )}
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite code */}
      {(isLeagueAdmin || isAppAdmin) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Invite Code</h2>
          <p className="font-mono text-2xl font-bold tracking-widest text-blue-600">{league.inviteCode}</p>
          <p className="text-gray-400 text-xs mt-1">Share this code with people you want to invite.</p>
        </div>
      )}
    </div>
  )
}
