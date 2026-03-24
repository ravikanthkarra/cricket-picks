'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function JoinLeagueForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/leagues/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: code }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to join')
      setLoading(false)
    } else {
      router.push(`/leagues/${data.leagueId}`)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 max-w-sm">
      <div className="flex gap-3 flex-1">
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Enter invite code"
          maxLength={8}
          className="flex-1 bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 font-mono tracking-widest uppercase focus:outline-none focus:border-blue-500"
        />
        <button type="submit" disabled={loading || code.length < 6}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-4 py-2 rounded">
          {loading ? '...' : 'Join'}
        </button>
      </div>
      {error && <p className="w-full text-red-600 text-sm">{error}</p>}
    </form>
  )
}
