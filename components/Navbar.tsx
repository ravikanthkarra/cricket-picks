'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  function navClass(href: string) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return active
      ? 'text-blue-600 font-semibold text-sm border-b-2 border-blue-600 pb-0.5 whitespace-nowrap'
      : 'text-gray-600 hover:text-gray-900 text-sm whitespace-nowrap'
  }

  const navLinks = (
    <>
      <Link href="/matches" className={navClass('/matches')}>Schedule</Link>
      <Link href="/picks" className={navClass('/picks')}>My Picks</Link>
      <Link href="/leagues" className={navClass('/leagues')}>Leagues</Link>
      <Link href="/leaderboard" className={navClass('/leaderboard')}>Leaderboard</Link>
      {session && (
        <Link href="/profile" className={navClass('/profile')}>Profile</Link>
      )}
      {session?.user?.role === 'admin' && (
        <Link href="/admin" className={navClass('/admin')}>Admin</Link>
      )}
    </>
  )

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4">

        {/* Top row: brand + auth */}
        <div className="h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-blue-600 whitespace-nowrap">
            <Image src="/logos/ipl.jpg" alt="IPL" width={32} height={32} className="rounded-full object-contain" />
            IPL 2026 Picks
          </Link>

          {/* Desktop nav links — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-6">
            {navLinks}
          </div>

          {/* Auth */}
          <div className="flex items-center gap-2 sm:gap-4">
            {session ? (
              <>
                <span className="hidden sm:inline text-gray-500 text-sm">{session.user.username}</span>
                <button
                  onClick={() => signOut()}
                  className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Login</Link>
                <Link href="/register" className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium px-3 py-1 rounded">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile nav links — second row, hidden on desktop */}
        <div className="sm:hidden flex items-center gap-5 pb-2 overflow-x-auto">
          {navLinks}
        </div>

      </div>
    </nav>
  )
}
