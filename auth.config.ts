import type { NextAuthConfig } from 'next-auth'
import { NextResponse } from 'next/server'

// Edge-safe config — no Prisma or bcryptjs imports.
// Used by middleware. Full auth.ts extends this with the Credentials provider.
export const authConfig = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  pages: { signIn: '/login' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = (user as any).username
        token.role = (user as any).role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.username = token.username as string
      session.user.role = token.role as string
      return session
    },
  },
  providers: [], // Credentials provider is added in auth.ts (Node.js only)
} satisfies NextAuthConfig
