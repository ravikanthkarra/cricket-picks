import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { LeagueAdminPanel } from '@/components/LeagueAdminPanel'
import { parseMarginConfig } from '@/lib/marginConfig'

export const dynamic = 'force-dynamic'

export default async function LeagueAdminPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { week?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const leagueId = parseInt(params.id)
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: {
        include: { user: { select: { id: true, username: true, displayName: true } } },
      },
    },
  })
  if (!league) notFound()

  const isLeagueAdmin = league.adminId === session.user.id
  const isAppAdmin = session.user.role === 'admin'
  if (!isLeagueAdmin && !isAppAdmin) redirect(`/leagues/${leagueId}`)

  // Get all weeks
  const weeks = await prisma.match.findMany({
    select: { weekNumber: true },
    distinct: ['weekNumber'],
    orderBy: { weekNumber: 'asc' },
  })
  const weekNumbers = weeks.map(w => w.weekNumber)
  const selectedWeek = parseInt(searchParams.week ?? String(weekNumbers[0] ?? 1))

  // Matches for selected week
  const weekMatches = await prisma.match.findMany({
    where: { weekNumber: selectedWeek },
    select: { id: true },
  })
  const matchIds = weekMatches.map(m => m.id)
  const totalMatchesInWeek = matchIds.length

  // Pick completion per member
  const memberStats = await Promise.all(
    league.members.map(async (member) => {
      const picksCompleted = await prisma.pick.count({
        where: { userId: member.userId, matchId: { in: matchIds } },
      })
      const correctPicks = await prisma.pick.count({
        where: { userId: member.userId, matchId: { in: matchIds }, isCorrect: true },
      })
      return {
        id: member.id,
        userId: member.userId,
        username: member.user.username,
        displayName: member.user.displayName,
        joinedAt: member.joinedAt.toISOString(),
        picksCompleted,
        picksTotal: totalMatchesInWeek,
        correctPicks,
        isComplete: picksCompleted === totalMatchesInWeek,
        isLeagueAdmin: member.userId === league.adminId,
      }
    })
  )

  return (
    <LeagueAdminPanel
      league={{
        id: league.id,
        name: league.name,
        description: league.description,
        rules: league.rules,
        inviteCode: league.inviteCode,
        adminId: league.adminId,
        marginConfig: parseMarginConfig(league.marginConfig),
        fanboyPoints: league.fanboyPoints,
      }}
      members={memberStats}
      weekNumbers={weekNumbers}
      selectedWeek={selectedWeek}
      currentUserId={session.user.id}
    />
  )
}
