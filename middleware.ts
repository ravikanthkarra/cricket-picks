import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin')
  const isAuthRoute = req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/register')
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/picks') || req.nextUrl.pathname.startsWith('/admin')

  if (isAdminRoute && (!isLoggedIn || req.auth?.user?.role !== 'admin')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
