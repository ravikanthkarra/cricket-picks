import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { FanboyPicker } from './FanboyPicker'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // All series (from matches)
  const allSeries = await prisma.match.findMany({
    select: { series: true },
    distinct: ['series'],
    orderBy: { series: 'asc' },
  })
  const seriesList = allSeries.map(s => s.series)

  // All teams (for picking)
  const teams = await prisma.team.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, shortName: true, primaryColor: true, logoUrl: true },
  })

  // User's existing fanboy picks, keyed by series
  const fanboyEntries = await prisma.userSeriesFanboy.findMany({
    where: { userId: session.user.id },
    include: { team: { select: { id: true, name: true, shortName: true, primaryColor: true, logoUrl: true } } },
  })
  const fanboyBySeries = Object.fromEntries(
    fanboyEntries.map(e => [e.series, {
      teamId: e.teamId,
      changedAt: e.changedAt ? e.changedAt.toISOString() : null,
      team: e.team,
    }])
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">
          Logged in as <span className="font-medium text-gray-700">{session.user.username}</span>
          {(session.user as any).displayName && ` · ${(session.user as any).displayName}`}
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-1">Fanboy Teams</h2>
        <p className="text-sm text-gray-500 mb-4">
          Pick your favourite team per series. You earn bonus points whenever your fanboy team wins
          and you picked them correctly. You can change your pick once per series.
        </p>

        {seriesList.length === 0 ? (
          <p className="text-gray-400 text-sm">No series available yet.</p>
        ) : (
          <div className="space-y-4">
            {seriesList.map(series => (
              <FanboyPicker
                key={series}
                series={series}
                teams={teams}
                initial={fanboyBySeries[series] ?? null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
