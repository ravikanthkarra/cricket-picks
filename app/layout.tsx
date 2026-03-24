import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IPL 2026 Picks',
  description: 'Make your IPL 2026 cricket match picks',
  icons: {
    icon: '/logos/ipl.jpg',
    apple: '/logos/ipl.jpg',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-gray-900 min-h-screen`}>
        <SessionProvider session={session}>
          <Navbar />
          <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        </SessionProvider>
      </body>
    </html>
  )
}
