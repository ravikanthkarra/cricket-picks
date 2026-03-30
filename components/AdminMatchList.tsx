'use client'
import { useState } from 'react'

type Team = { id: number; name: string; shortName: string; primaryColor: string }
type Match = {
  id: number; matchNumber: number; weekNumber: number
  homeTeam: Team; awayTeam: Team; winningTeam: Team | null
  scheduledAt: Date | string; status: string; venue: string
  margin: string | null
}

const MARGIN_OPTIONS = [
  { value: '',           label: '— no margin set —' },
  { value: 'BLOWOUT',    label: 'Blowout (+4/−3)' },
  { value: 'NAIL_BITER', label: 'Nail Biter (+3/−2)' },
  { value: 'EASY',       label: 'Easy (+2/−1)' },
  { value: 'NO_MARGIN',  label: 'No Margin (0/0)' },
]

export function AdminMatchList({ matches }: { matches: Match[] }) {
  const [results, setResults] = useState<Record<number, 'home' | 'away' | 'no_result' | null>>(
    Object.fromEntries(matches.map(m => [m.id, null]))
  )
  const [margins, setMargins] = useState<Record<number, string>>(
    Object.fromEntries(matches.map(m => [m.id, '']))
  )
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})

  async function submitResult(match: Match) {
    const pick = results[match.id]
    if (!pick) return

    setSaving(s => ({ ...s, [match.id]: true }))

    let res: Response
    if (pick === 'no_result') {
      res = await fetch(`/api/admin/matches/${match.id}/no-result`, { method: 'PUT' })
    } else {
      const winningTeamId = pick === 'home' ? match.homeTeam.id : match.awayTeam.id
      const margin = margins[match.id] || null
      res = await fetch(`/api/admin/matches/${match.id}/result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningTeamId, margin }),
      })
    }

    if (res.ok) {
      setSaved(s => ({ ...s, [match.id]: true }))
    } else {
      const data = await res.json()
      setErrors(e => ({ ...e, [match.id]: data.error || 'Failed' }))
    }
    setSaving(s => ({ ...s, [match.id]: false }))
  }

  // Group by week
  const byWeek: Record<number, Match[]> = {}
  for (const m of matches) {
    if (!byWeek[m.weekNumber]) byWeek[m.weekNumber] = []
    byWeek[m.weekNumber].push(m)
  }

  return (
    <div className="space-y-10">
      {Object.entries(byWeek).map(([week, weekMatches]) => (
        <div key={week}>
          <h2 className="text-lg font-semibold text-blue-600 mb-4">Week {week}</h2>
          <div className="space-y-3">
            {weekMatches.map(match => (
              <div key={match.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-gray-400 text-xs">Match {match.matchNumber} &bull; {match.venue.split(',')[0]}</span>
                    <div className="font-semibold mt-1">
                      <span style={{ color: match.homeTeam.primaryColor }}>{match.homeTeam.shortName}</span>
                      <span className="text-gray-400 mx-2">vs</span>
                      <span style={{ color: match.awayTeam.primaryColor }}>{match.awayTeam.shortName}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    {new Date(match.scheduledAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    {match.status === 'completed' && (
                      <div className="text-green-600 mt-1">
                        Result set: {match.winningTeam?.shortName} won
                        {match.margin && <span className="text-blue-600 ml-1">· {match.margin.replace('_', ' ')}</span>}
                      </div>
                    )}
                    {match.status === 'no_result' && (
                      <div className="text-amber-600 mt-1 font-medium">No Result</div>
                    )}
                  </div>
                </div>

                {match.status !== 'completed' && match.status !== 'no_result' && (
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name={`result-${match.id}`}
                          onChange={() => setResults(r => ({ ...r, [match.id]: 'home' }))}
                          className="accent-blue-600" />
                        <span className="text-sm" style={{ color: match.homeTeam.primaryColor }}>{match.homeTeam.shortName} won</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name={`result-${match.id}`}
                          onChange={() => setResults(r => ({ ...r, [match.id]: 'away' }))}
                          className="accent-blue-600" />
                        <span className="text-sm" style={{ color: match.awayTeam.primaryColor }}>{match.awayTeam.shortName} won</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name={`result-${match.id}`}
                          onChange={() => setResults(r => ({ ...r, [match.id]: 'no_result' }))}
                          className="accent-amber-500" />
                        <span className="text-sm text-amber-600 font-medium">No Result</span>
                      </label>
                    </div>
                    {results[match.id] !== 'no_result' && (
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-500 font-medium whitespace-nowrap">Margin:</label>
                        <select
                          value={margins[match.id] ?? ''}
                          onChange={e => setMargins(m => ({ ...m, [match.id]: e.target.value }))}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                        >
                          {MARGIN_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => submitResult(match)}
                        disabled={!results[match.id] || saving[match.id] || saved[match.id]}
                        className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-4 py-1.5 rounded whitespace-nowrap"
                      >
                        {saving[match.id] ? 'Saving...' : saved[match.id] ? 'Saved ✓' : results[match.id] === 'no_result' ? 'Set No Result' : 'Set Result'}
                      </button>
                    </div>
                    {errors[match.id] && <span className="text-red-600 text-xs">{errors[match.id]}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
