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
  const initialWithDefaults = Object.fromEntries(
    matches.map(m => [m.id, initialMarginPickMap[m.id] ?? 'NO_MARGIN'])
  )
  const [marginPickMap, setMarginPickMap] = useState<Record<number, string>>(initialWithDefaults)
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})

  // Swap mode state
  const [swapMode, setSwapMode] = useState(false)
  const [swapSelection, setSwapSelection] = useState<number[]>([]) // matchIds selected for swap
  const [swapSaving, setSwapSaving] = useState(false)
  const [swapError, setSwapError] = useState('')

  const now = new Date()

  async function savePick(matchId: number, teamId: number, points: number | undefined, marginPick?: string) {
    if (!points) return
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

  function usedPoints(currentMatchId: number): Set<number> {
    const used = new Set<number>()
    Object.entries(pointsMap).forEach(([matchId, pts]) => {
      if (parseInt(matchId) !== currentMatchId) used.add(pts)
    })
    return used
  }

  // Swap helpers
  function unlockedMatchesWithPoints() {
    return matches.filter(m => new Date(m.lockTime) > now && m.status === 'upcoming' && pointsMap[m.id])
  }

  function toggleSwapSelect(matchId: number) {
    setSwapError('')
    setSwapSelection(sel => {
      if (sel.includes(matchId)) return sel.filter(id => id !== matchId)
      if (sel.length >= 2) return [sel[1], matchId] // replace oldest
      return [...sel, matchId]
    })
  }

  async function confirmSwap() {
    if (swapSelection.length !== 2) return
    const [idA, idB] = swapSelection
    setSwapSaving(true)
    setSwapError('')
    const res = await fetch('/api/picks/swap-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchIdA: idA, matchIdB: idB }),
    })
    if (res.ok) {
      const { pointsA, pointsB } = await res.json()
      setPointsMap(m => ({ ...m, [idA]: pointsA, [idB]: pointsB }))
      setSwapMode(false)
      setSwapSelection([])
    } else {
      const data = await res.json()
      setSwapError(data.error || 'Swap failed')
    }
    setSwapSaving(false)
  }

  function cancelSwap() {
    setSwapMode(false)
    setSwapSelection([])
    setSwapError('')
  }

  const swappable = unlockedMatchesWithPoints()
  const canSwap = swappable.length >= 2

  // Pending swap confirmation (2 selected)
  const swapA = swapSelection[0] ? matches.find(m => m.id === swapSelection[0]) : null
  const swapB = swapSelection[1] ? matches.find(m => m.id === swapSelection[1]) : null

  return (
    <div className="space-y-4">
      {/* Swap mode toolbar */}
      {canSwap && (
        <div className="flex items-center gap-3 flex-wrap">
          {!swapMode ? (
            <button
              onClick={() => setSwapMode(true)}
              className="text-sm border border-blue-500 text-blue-600 hover:bg-blue-50 font-medium px-4 py-1.5 rounded-lg"
            >
              ⇄ Swap Points
            </button>
          ) : (
            <div className="flex items-center gap-3 flex-wrap w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <span className="text-sm text-blue-700 font-medium">
                {swapSelection.length === 0 && 'Select two matches to swap points'}
                {swapSelection.length === 1 && 'Now select the second match'}
                {swapSelection.length === 2 && swapA && swapB && (
                  <>Swap <strong>{pointsMap[swapA.id]}pts</strong> (M{swapA.matchNumber}) ↔ <strong>{pointsMap[swapB.id]}pts</strong> (M{swapB.matchNumber})?</>
                )}
              </span>
              <div className="flex gap-2 ml-auto">
                {swapSelection.length === 2 && (
                  <button
                    onClick={confirmSwap}
                    disabled={swapSaving}
                    className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded"
                  >
                    {swapSaving ? 'Swapping…' : 'Confirm'}
                  </button>
                )}
                <button onClick={cancelSwap} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
                  Cancel
                </button>
              </div>
              {swapError && <p className="w-full text-red-600 text-xs mt-1">{swapError}</p>}
            </div>
          )}
        </div>
      )}

      {matches.map(match => {
        const isLocked = new Date(match.lockTime) <= now || match.status !== 'upcoming'
        const isCompleted = match.status === 'completed'
        const userTeamPick = picksMap[match.id]
        const userPoints = pointsMap[match.id]
        const userMarginPick = marginPickMap[match.id]
        const isSaving = saving[match.id]
        const takenPoints = usedPoints(match.id)
        const allPoints = Array.from({ length: weekMatchCount }, (_, i) => i + 1)

        const isSwappable = swapMode && !isLocked && !!userPoints
        const isSwapSelected = swapSelection.includes(match.id)

        return (
          <div key={match.id} className={`bg-white rounded-xl border-2 p-5 transition-all ${
            isSwapSelected ? 'border-blue-500 shadow-md' :
            swapMode && isSwappable ? 'border-blue-200 cursor-pointer hover:border-blue-400' :
            'border-gray-200'
          }`}
            onClick={isSwappable ? () => toggleSwapSelect(match.id) : undefined}
          >
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
                {isSwapSelected && (
                  <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Selected ✓</span>
                )}
                {!isSwapSelected && isLocked && !isCompleted && (
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
                    onClick={e => { e.stopPropagation(); !isLocked && !isSaving && !swapMode && handleTeamClick(match.id, team.id) }}
                    disabled={isLocked || isSaving || swapMode}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      isCorrect ? 'border-green-500 bg-green-50' :
                      isWrong ? 'border-red-500 bg-red-50' :
                      isPicked ? 'border-blue-600 bg-blue-50' :
                      isLocked || swapMode ? 'bg-gray-100 opacity-60 cursor-not-allowed border-gray-200' :
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
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <label className="text-sm text-gray-500 font-medium whitespace-nowrap">Points:</label>
              <select
                value={userPoints ?? ''}
                onChange={e => handlePointsChange(match.id, parseInt(e.target.value))}
                disabled={isLocked || isSaving || swapMode}
                className={`flex-1 min-w-0 border rounded-lg px-2 py-2 text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors ${
                  isLocked || swapMode
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
              {isSaving && <span className="text-xs text-gray-400 shrink-0">Saving…</span>}
              {userPoints && !isSaving && (
                <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold flex-shrink-0 ${
                  isCompleted
                    ? picksMap[match.id] === match.winningTeam?.id
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                    : isSwapSelected ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                  {userPoints}
                </div>
              )}
            </div>

            {/* Margin prediction */}
            <div className="flex items-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
              <label className="text-sm text-gray-500 font-medium whitespace-nowrap">Margin:</label>
              <select
                value={userMarginPick ?? ''}
                onChange={e => handleMarginChange(match.id, e.target.value)}
                disabled={isLocked || isSaving || swapMode}
                className={`flex-1 min-w-0 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors ${
                  isLocked || swapMode
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

            {userTeamPick && !userPoints && !isLocked && !swapMode && (
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
