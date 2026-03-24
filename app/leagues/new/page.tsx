'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewLeaguePage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [seriesList, setSeriesList] = useState<string[]>([])
  const [series, setSeries] = useState('')

  useEffect(() => {
    fetch('/api/series')
      .then(r => r.json())
      .then((data: string[]) => {
        setSeriesList(data)
        if (data.length > 0) setSeries(data[0])
      })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value
    const description = (form.elements.namedItem('description') as HTMLInputElement).value
    const rules = (form.elements.namedItem('rules') as HTMLTextAreaElement).value

    const res = await fetch('/api/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, rules, series }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to create league')
      setLoading(false)
    } else {
      router.push(`/leagues/${data.id}`)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-8">Create a League</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-xl border border-gray-200">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div>
          <label className="block text-sm text-gray-500 mb-1">League Name *</label>
          <input name="name" required
            className="w-full bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Series *</label>
          <select
            value={series}
            onChange={e => setSeries(e.target.value)}
            required
            className="w-full bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
          >
            {seriesList.length === 0 && <option value="">Loading...</option>}
            {seriesList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Members will make picks for matches in this series.</p>
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Description</label>
          <input name="description"
            placeholder="e.g. Office fantasy league"
            className="w-full bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">League Rules</label>
          <textarea name="rules" rows={4}
            placeholder="e.g. 1 point per correct pick. Most points at end of season wins. Tiebreaker: fewest total picks made."
            className="w-full bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500 resize-none" />
        </div>
        <button type="submit" disabled={loading || !series}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold py-2 rounded">
          {loading ? 'Creating...' : 'Create League'}
        </button>
      </form>
    </div>
  )
}
