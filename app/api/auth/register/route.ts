import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { email, username, password, displayName } = await req.json()

  if (!email || !username || !password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  })
  if (existing) {
    return NextResponse.json({ error: 'Email or username already taken' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, username, displayName: displayName || username, passwordHash },
  })

  return NextResponse.json({ id: user.id, email: user.email, username: user.username }, { status: 201 })
}
