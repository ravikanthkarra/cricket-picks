'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    try {
      const res = await signIn('credentials', { email, password, redirect: false })
      if (res?.error) {
        setError('Invalid email or password')
        setLoading(false)
      } else {
        router.push('/picks')
        router.refresh()
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold text-center mb-8 text-blue-600">Sign In</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl border border-gray-200">
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        <div>
          <label className="block text-sm text-gray-500 mb-1">Email</label>
          <input name="email" type="email" required
            className="w-full bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Password</label>
          <input name="password" type="password" required
            className="w-full bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2 rounded">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <p className="text-center text-sm text-gray-400">
          No account? <Link href="/register" className="text-blue-600 hover:underline">Sign up</Link>
        </p>
      </form>
    </div>
  )
}
