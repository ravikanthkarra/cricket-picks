'use client'

import { useState } from 'react'
import { TeamBadge } from '@/components/TeamBadge'

type Team = {
  id: number
  name: string
  shortName: string
  primaryColor: string
  logoUrl: string | null
}

type FanboyEntry = {
  teamId: number
  changedAt: string | null
  team: Team
}

type Props = {
  leagueId: number
  teams: Team[]
  initial: FanboyEntry | null
}

export function LeagueFanboyPicker({ leagueId, teams, initial }: Props) {
  const [current, setCurrent] = useState<FanboyEntry | null>(initial)
  const [pending, setPending] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const locked = !!current?.changedAt
  const hasTeam = !!current

  async function save(teamId: number) {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch(`/api/leagues/${leagueId}/fanboy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save')
      } else {
        setCurrent(data)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
      setPending(null)
    }
  }

  function handleTeamClick(teamId: number) {
    if (locked || saving) return
    if (current?.teamId === teamId) return
    if (hasTeam) {
      setPending(teamId)
    } else {
      save(teamId)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-gray-800">My Fanboy Team</h2>
          <p className="text-xs text-gray-400 mt-0.5">Pick your favourite team for this league. You earn bonus points when they win and you picked them.</p>
        </div>
        {locked && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium shrink-0 ml-3">Change used</span>
        )}
        {!locked && hasTeam && (
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium shrink-0 ml-3">1 change left</span>
        )}
      </div>

      {current && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg">
          <TeamBadge shortName={current.team.shortName} primaryColor={current.team.primaryColor} logoUrl={current.team.logoUrl} size="md" />
          <div>
            <p className="text-sm font-medium text-blue-800">{current.team.name}</p>
            <p className="text-xs text-blue-500">Your fanboy team{current.changedAt ? ' · locked' : ''}</p>
          </div>
          <span className="ml-auto text-amber-400 text-xl">⭐</span>
        </div>
      )}

      {locked ? (
        <p className="text-sm text-gray-400 italic">Your fanboy team is locked for this league.</p>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-3">{hasTeam ? 'Click a team to change (one change allowed)' : 'Pick your fanboy team'}</p>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {teams.map(team => {
              const selected = current?.teamId === team.id
              return (
                <button
                  key={team.id}
                  onClick={() => handleTeamClick(team.id)}
                  disabled={saving}
                  title={team.name}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
                    selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  <TeamBadge shortName={team.shortName} primaryColor={team.primaryColor} logoUrl={team.logoUrl} size="sm" />
                  <span className="text-xs text-gray-600 leading-tight text-center">{team.shortName}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {pending !== null && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium mb-1">⚠️ This is your one allowed change</p>
          <p className="text-sm text-amber-700 mb-3">
            Switching to <strong>{teams.find(t => t.id === pending)?.name}</strong> will use your one allowed change for this league.
          </p>
          <div className="flex gap-2">
            <button onClick={() => save(pending)} disabled={saving}
              className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Yes, change team'}
            </button>
            <button onClick={() => setPending(null)} disabled={saving}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-2 text-sm text-green-600">✓ Fanboy team saved!</p>}
    </div>
  )
}
