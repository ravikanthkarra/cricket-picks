'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DEFAULT_MARGIN_CONFIG, type MarginConfig } from '@/lib/marginConfig'

type Member = {
  id: number
  userId: string
  username: string
  displayName: string | null
  joinedAt: string
  picksCompleted: number
  picksTotal: number
  correctPicks: number
  isComplete: boolean
  isLeagueAdmin: boolean
}

type League = {
  id: number
  name: string
  description: string | null
  rules: string | null
  inviteCode: string
  adminId: string
  marginConfig: MarginConfig
  fanboyPoints: number
}

const MARGIN_LABELS: Record<string, string> = {
  BLOWOUT:    'Blowout',
  NAIL_BITER: 'Nail Biter',
  EASY:       'Easy',
  NO_MARGIN:  'No Margin',
}

export function LeagueAdminPanel({
  league,
  members,
  weekNumbers,
  selectedWeek,
  currentUserId,
}: {
  league: League
  members: Member[]
  weekNumbers: number[]
  selectedWeek: number
  currentUserId: string
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: league.name,
    description: league.description ?? '',
    rules: league.rules ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Margin config state — each margin type has correct/wrong point values
  const [marginConfig, setMarginConfig] = useState<MarginConfig>(league.marginConfig)
  const [marginSaving, setMarginSaving] = useState(false)
  const [marginMsg, setMarginMsg] = useState('')

  // Fanboy bonus points
  const [fanboyPoints, setFanboyPoints] = useState(league.fanboyPoints)
  const [fanboySaving, setFanboySaving] = useState(false)
  const [fanboyMsg, setFanboyMsg] = useState('')

  async function saveSettings() {
    setSaving(true)
    setSaveMsg('')
    const res = await fetch(`/api/leagues/${league.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setSaveMsg('Saved!')
      router.refresh()
    } else {
      setSaveMsg('Failed to save')
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  async function saveMarginConfig() {
    setMarginSaving(true)
    setMarginMsg('')
    const res = await fetch(`/api/leagues/${league.id}/margin-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(marginConfig),
    })
    if (res.ok) {
      setMarginMsg('Saved!')
      router.refresh()
    } else {
      const data = await res.json()
      setMarginMsg(data.error || 'Failed to save')
    }
    setMarginSaving(false)
    setTimeout(() => setMarginMsg(''), 3000)
  }

  async function saveFanboyPoints() {
    setFanboySaving(true)
    setFanboyMsg('')
    const res = await fetch(`/api/leagues/${league.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fanboyPoints }),
    })
    if (res.ok) {
      setFanboyMsg('Saved!')
      router.refresh()
    } else {
      setFanboyMsg('Failed to save')
    }
    setFanboySaving(false)
    setTimeout(() => setFanboyMsg(''), 3000)
  }

  function updateMarginRule(key: string, field: 'correct' | 'wrong', raw: string) {
    const val = parseInt(raw)
    if (isNaN(val)) return
    setMarginConfig(c => ({ ...c, [key]: { ...c[key], [field]: val } }))
  }

  async function removeMember(userId: string) {
    if (!confirm('Remove this member from the league?')) return
    setRemovingId(userId)
    await fetch(`/api/leagues/${league.id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setRemovingId(null)
    router.refresh()
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(league.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const completed = members.filter(m => m.isComplete).length
  const total = members.length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href={`/leagues/${league.id}`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Back to {league.name}
        </Link>
        <h1 className="text-2xl font-bold mt-2">Manage League</h1>
      </div>

      {/* Invite Code */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Invite Code</h2>
        <div className="flex items-center gap-4">
          <span className="font-mono text-2xl font-bold tracking-widest text-blue-600">{league.inviteCode}</span>
          <button onClick={copyInviteCode}
            className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded">
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
        <p className="text-gray-400 text-xs mt-1">Share with friends to invite them to this league.</p>
      </div>

      {/* Settings */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">League Settings</h2>
        <div>
          <label className="block text-sm text-gray-500 mb-1">League Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">League Rules</label>
          <textarea value={form.rules} onChange={e => setForm(f => ({ ...f, rules: e.target.value }))}
            rows={5} className="w-full bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500 resize-none" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveSettings} disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-5 py-2 rounded text-sm">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saveMsg && <span className={`text-sm ${saveMsg === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{saveMsg}</span>}
        </div>
      </div>

      {/* Margin Point System */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Margin Point System</h2>
          <p className="text-gray-400 text-xs mt-1">
            Set how many bonus points players earn or lose when they correctly or incorrectly predict the match margin.
            These apply only to this league's standings.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
                <th className="pb-2 pr-4">Margin Type</th>
                <th className="pb-2 pr-4 text-center">Correct Pick<br /><span className="font-normal">(bonus pts)</span></th>
                <th className="pb-2 text-center">Wrong Pick<br /><span className="font-normal">(penalty pts)</span></th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(DEFAULT_MARGIN_CONFIG).map(key => (
                <tr key={key} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 pr-4 font-medium text-gray-700">{MARGIN_LABELS[key]}</td>
                  <td className="py-3 pr-4 text-center">
                    <input
                      type="number"
                      value={marginConfig[key]?.correct ?? 0}
                      onChange={e => updateMarginRule(key, 'correct', e.target.value)}
                      className="w-20 text-center border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 text-green-700 font-bold"
                    />
                  </td>
                  <td className="py-3 text-center">
                    <input
                      type="number"
                      value={marginConfig[key]?.wrong ?? 0}
                      onChange={e => updateMarginRule(key, 'wrong', e.target.value)}
                      className="w-20 text-center border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 text-red-600 font-bold"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveMarginConfig} disabled={marginSaving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-5 py-2 rounded text-sm">
            {marginSaving ? 'Saving...' : 'Save Margin Config'}
          </button>
          {marginMsg && <span className={`text-sm ${marginMsg === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{marginMsg}</span>}
        </div>
      </div>

      {/* Fanboy Bonus Points */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Fanboy Bonus</h2>
          <p className="text-gray-400 text-xs mt-1">
            Bonus points awarded when a player correctly picks their fanboy team to win.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-700 font-medium">Bonus points per correct fanboy pick</label>
          <input
            type="number"
            min={0}
            max={20}
            value={fanboyPoints}
            onChange={e => setFanboyPoints(parseInt(e.target.value) || 0)}
            className="w-20 text-center border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 text-blue-700 font-bold"
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveFanboyPoints} disabled={fanboySaving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-5 py-2 rounded text-sm">
            {fanboySaving ? 'Saving...' : 'Save Fanboy Config'}
          </button>
          {fanboyMsg && <span className={`text-sm ${fanboyMsg === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{fanboyMsg}</span>}
        </div>
      </div>

      {/* Members + Pick Completion */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Members</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              Week {selectedWeek}: {completed}/{total} members have completed their picks
            </p>
          </div>
          {weekNumbers.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {weekNumbers.map(week => (
                <a key={week} href={`/leagues/${league.id}/admin?week=${week}`}
                  className={`px-3 py-1.5 rounded text-sm font-medium ${
                    week === selectedWeek ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  W{week}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3 text-center">Picks (Week {selectedWeek})</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Correct</th>
                <th className="px-4 py-3 text-center">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{member.displayName || member.username}</div>
                    <div className="text-gray-400 text-xs">@{member.username}</div>
                    {member.isLeagueAdmin && (
                      <span className="text-xs text-blue-600">Admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono">{member.picksCompleted}/{member.picksTotal}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {member.picksTotal === 0 ? (
                      <span className="text-gray-400 text-xs">—</span>
                    ) : member.isComplete ? (
                      <span className="inline-block bg-green-100 text-green-600 text-xs px-2 py-0.5 rounded">Complete</span>
                    ) : (
                      <span className="inline-block bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-blue-600 font-bold">
                    {member.correctPicks}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs">
                    {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!member.isLeagueAdmin && member.userId !== currentUserId && (
                      <button
                        onClick={() => removeMember(member.userId)}
                        disabled={removingId === member.userId}
                        className="text-xs text-red-600 hover:text-red-500 disabled:opacity-40">
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
