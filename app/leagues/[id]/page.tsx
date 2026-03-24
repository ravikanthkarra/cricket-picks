import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { parseMarginConfig, calcMarginPoints } from '@/lib/marginConfig'

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

  // Leaderboard: recalculate using this league's margin config
  const marginConfig = parseMarginConfig(league.marginConfig)
  const memberUserIds = league.members.map(m => m.userId)

  const memberPicks = await prisma.pick.findMany({
    where: { userId: { in: memberUserIds }, isCorrect: { not: null }, match: { series: league.series } },
    include: { match: { select: { margin: true } }, user: { select: { username: true, displayName: true } } },
  })

  // Fanboy entries for this series — used to apply per-league fanboy bonus
  const fanboyEntries = await prisma.userSeriesFanboy.findMany({
    where: { userId: { in: memberUserIds }, series: league.series },
    select: { userId: true, teamId: true },
  })
  const fanboyTeamByUser: Record<string, number> = {}
  for (const f of fanboyEntries) fanboyTeamByUser[f.userId] = f.teamId

  // Group by userId and calculate score using this league's margin config + fanboy bonus
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

      {/* Leaderboard */}
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
