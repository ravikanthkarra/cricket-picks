import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminMatchList } from '@/components/AdminMatchList'

export const dynamic = 'force-dynamic'

export default async function AdminPage({ searchParams }: { searchParams: { audit?: string } }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') redirect('/')

  const matches = await prisma.match.findMany({
    include: { homeTeam: true, awayTeam: true, winningTeam: true },
    orderBy: [{ weekNumber: 'asc' }, { scheduledAt: 'asc' }],
  })

  // Audit log — last 200 entries, newest first
  const auditLogs = await prisma.pickAuditLog.findMany({
    orderBy: { submittedAt: 'desc' },
    take: 200,
    include: {
      user: { select: { username: true, displayName: true } },
    },
  })

  // Pre-fetch match info for audit log display
  const matchIds = Array.from(new Set(auditLogs.map(l => l.matchId)))
  const matchMap = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    include: { homeTeam: true, awayTeam: true },
  }).then(ms => Object.fromEntries(ms.map(m => [m.id, m])))

  const teamIds = Array.from(new Set(auditLogs.map(l => l.pickedTeamId).filter(Boolean) as number[]))
  const teamMap = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, shortName: true },
  }).then(ts => Object.fromEntries(ts.map(t => [t.id, t])))

  const showAudit = searchParams.audit === '1'

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-2">Admin Panel</h1>
        <p className="text-gray-500 mb-8">Set match results to update the leaderboard.</p>
        <AdminMatchList matches={matches} />
      </div>

      {/* Audit Log */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Pick Audit Log</h2>
            <p className="text-sm text-gray-500 mt-0.5">Every pick submission — successful and rejected.</p>
          </div>
          <a href={`/admin?audit=${showAudit ? '0' : '1'}`}
            className="text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 px-4 py-2 rounded font-medium">
            {showAudit ? 'Hide' : 'Show'} Log
          </a>
        </div>

        {showAudit && (
          auditLogs.length === 0 ? (
            <p className="text-gray-400 text-sm">No audit entries yet.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 whitespace-nowrap">Time (UTC)</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Match</th>
                    <th className="px-4 py-3">Pick</th>
                    <th className="px-4 py-3">Pts</th>
                    <th className="px-4 py-3">Lock Time (UTC)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => {
                    const match = matchMap[log.matchId]
                    const team = log.pickedTeamId ? teamMap[log.pickedTeamId] : null
                    const isSuccess = log.status === 'success'
                    return (
                      <tr key={log.id} className={`border-b border-gray-100 last:border-0 ${isSuccess ? '' : 'bg-red-50'}`}>
                        <td className="px-4 py-2 font-mono text-xs whitespace-nowrap text-gray-500">
                          {new Date(log.submittedAt).toISOString().replace('T', ' ').slice(0, 19)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {log.user.displayName || log.user.username}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                          {match ? `M${match.matchNumber} ${match.homeTeam.shortName} v ${match.awayTeam.shortName}` : `#${log.matchId}`}
                        </td>
                        <td className="px-4 py-2 font-medium">
                          {team?.shortName ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {log.points ?? '—'}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs whitespace-nowrap text-gray-500">
                          {new Date(log.matchLockTime).toISOString().replace('T', ' ').slice(0, 19)}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {isSuccess ? 'saved' : 'rejected'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {log.reason ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
