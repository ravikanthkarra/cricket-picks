'use client'
import { useState } from 'react'
import { TeamBadge } from '@/components/TeamBadge'

type Team = { id: number; name: string; shortName: string; primaryColor: string; logoUrl?: string | null }
type Match = {
  id: number
  matchNumber: number
  homeTeam: Team
  awayTeam: Team
  winningTeam: Team | null
  scheduledAt: Date | string
  lockTime: Date | string
  status: string
  venue: string
}

const MARGIN_OPTIONS = [
  { value: 'BLOWOUT',    label: 'Blowout',    hint: '(+4 if correct / -3 if wrong)' },
  { value: 'NAIL_BITER', label: 'Nail Biter', hint: '(+3 / -2)' },
  { value: 'EASY',       label: 'Easy',       hint: '(+2 / -1)' },
  { value: 'NO_MARGIN',  label: 'No Margin',  hint: '(no bonus)' },
]

export function PicksWeekView({ matches, picksMap: initialPicksMap, pointsMap: initialPointsMap, marginPickMap: initialMarginPickMap, weekMatchCount }: {
  matches: Match[]
  picksMap: Record<number, number>
  pointsMap: Record<number, number>
  marginPickMap: Record<number, string>
  weekMatchCount: number
}) {
  const [picksMap, setPicksMap] = useState<Record<number, number>>(initialPicksMap)
  const [pointsMap, setPointsMap] = useState<Record<number, number>>(initialPointsMap)
  // Default any unset margin pick to NO_MARGIN
  const initialWithDefaults = Object.fromEntries(
    matches.map(m => [m.id, initialMarginPickMap[m.id] ?? 'NO_MARGIN'])
  )
  const [marginPickMap, setMarginPickMap] = useState<Record<number, string>>(initialWithDefaults)
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})

  const now = new Date()

  async function savePick(matchId: number, teamId: number, points: number | undefined, marginPick?: string) {
    if (!points) return // don't save until both team and points are set
    setSaving(s => ({ ...s, [matchId]: true }))
    setErrors(e => ({ ...e, [matchId]: '' }))
    const res = await fetch('/api/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, pickedTeamId: teamId, points, marginPick: marginPick || null }),
    })
    if (!res.ok) {
      try {
        const data = await res.json()
        setErrors(e => ({ ...e, [matchId]: data.error || 'Failed to save pick' }))
      } catch {
        setErrors(e => ({ ...e, [matchId]: 'Failed to save pick' }))
      }
    }
    setSaving(s => ({ ...s, [matchId]: false }))
  }

  function handleTeamClick(matchId: number, teamId: number) {
    setPicksMap(m => ({ ...m, [matchId]: teamId }))
    savePick(matchId, teamId, pointsMap[matchId], marginPickMap[matchId])
  }

  function handlePointsChange(matchId: number, points: number) {
    setPointsMap(m => ({ ...m, [matchId]: points }))
    const teamId = picksMap[matchId]
    if (teamId) savePick(matchId, teamId, points, marginPickMap[matchId])
  }

  function handleMarginChange(matchId: number, margin: string) {
    setMarginPickMap(m => ({ ...m, [matchId]: margin }))
    const teamId = picksMap[matchId]
    if (teamId) savePick(matchId, teamId, pointsMap[matchId], margin)
  }

  // Points used by OTHER matches (not the current one being rendered)
  function usedPoints(currentMatchId: number): Set<number> {
    const used = new Set<number>()
    Object.entries(pointsMap).forEach(([matchId, pts]) => {
      if (parseInt(matchId) !== currentMatchId) used.add(pts)
    })
    return used
  }

  return (
    <div className="space-y-4">
      {matches.map(match => {
        const isLocked = new Date(match.lockTime) <= now || match.status !== 'upcoming'
        const isCompleted = match.status === 'completed'
        const userTeamPick = picksMap[match.id]
        const userPoints = pointsMap[match.id]
        const userMarginPick = marginPickMap[match.id]
        const isSaving = saving[match.id]
        const takenPoints = usedPoints(match.id)
        const allPoints = Array.from({ length: weekMatchCount }, (_, i) => i + 1)

        return (
          <div key={match.id} className="bg-white rounded-xl border border-gray-200 p-5">
            {/* Match header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-gray-400 text-xs">Match {match.matchNumber}</span>
                <div className="text-gray-500 text-xs mt-0.5">{match.venue.split(',')[0]}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-500 text-xs">
                  {new Date(match.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="text-gray-400 text-xs">
                  {new Date(match.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                {isLocked && !isCompleted && (
                  <span className="inline-block mt-1 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">Locked</span>
                )}
                {isCompleted && (
                  <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Final</span>
                )}
              </div>
            </div>

            {/* Team pick buttons */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[match.homeTeam, match.awayTeam].map(team => {
                const isPicked = userTeamPick === team.id
                const isWinner = match.winningTeam?.id === team.id
                const isCorrect = isCompleted && isPicked && isWinner
                const isWrong = isCompleted && isPicked && !isWinner

                return (
                  <button
                    key={team.id}
                    onClick={() => !isLocked && !isSaving && handleTeamClick(match.id, team.id)}
                    disabled={isLocked || isSaving}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      isCorrect ? 'border-green-500 bg-green-50' :
                      isWrong ? 'border-red-500 bg-red-50' :
                      isPicked ? 'border-blue-600 bg-blue-50' :
                      isLocked ? 'bg-gray-100 opacity-60 cursor-not-allowed border-gray-200' :
                      'border-gray-200 bg-white hover:border-blue-400 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <TeamBadge shortName={team.shortName} primaryColor={team.primaryColor} logoUrl={team.logoUrl} size="md" />
                      <div>
                        <div className="font-bold text-sm" style={{ color: team.primaryColor }}>
                          {team.shortName}
                        </div>
                        <div className="text-gray-500 text-xs">{team.name}</div>
                      </div>
                    </div>
                    {isPicked && (
                      <div className={`text-xs mt-2 font-medium ${
                        isCorrect ? 'text-green-600' : isWrong ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {isCorrect ? '✓ Correct!' : isWrong ? '✗ Wrong' : '✓ Your Pick'}
                      </div>
                    )}
                    {isCompleted && isWinner && !isPicked && (
                      <div className="text-xs mt-2 text-gray-400">Winner</div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Points dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 font-medium whitespace-nowrap">
                Points:
              </label>
              <select
                value={userPoints ?? ''}
                onChange={e => handlePointsChange(match.id, parseInt(e.target.value))}
                disabled={isLocked || isSaving}
                className={`flex-1 min-w-0 border rounded-lg px-2 py-2 text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors ${
                  isLocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                    : userPoints
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-500'
                }`}
              >
                <option value="">— select —</option>
                {allPoints.map(p => (
                  <option key={p} value={p} disabled={takenPoints.has(p)}>
                    {p}{p === weekMatchCount ? ' (highest)' : p === 1 ? ' (lowest)' : ''}
                    {takenPoints.has(p) ? ' — used' : ''}
                  </option>
                ))}
              </select>

              {/* Saving indicator */}
              {isSaving && <span className="text-xs text-gray-400 shrink-0">Saving…</span>}

              {/* Points badge when saved */}
              {userPoints && !isSaving && (
                <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold flex-shrink-0 ${
                  isCompleted
                    ? picksMap[match.id] === match.winningTeam?.id
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {userPoints}
                </div>
              )}
            </div>

            {/* Margin prediction (optional) */}
            <div className="flex items-center gap-2 mt-3">
              <label className="text-sm text-gray-500 font-medium whitespace-nowrap">
                Margin:
              </label>
              <select
                value={userMarginPick ?? ''}
                onChange={e => handleMarginChange(match.id, e.target.value)}
                disabled={isLocked || isSaving}
                className={`flex-1 min-w-0 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors ${
                  isLocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                    : userMarginPick
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-500'
                }`}
              >
                {MARGIN_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} {opt.hint}
                  </option>
                ))}
              </select>
            </div>

            {/* Prompt if team picked but no points yet */}
            {userTeamPick && !userPoints && !isLocked && (
              <p className="text-xs text-amber-600 mt-2">Don't forget to assign confidence points!</p>
            )}

            {errors[match.id] && (
              <p className="text-red-600 text-xs mt-2">{errors[match.id]}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
