
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'

const prisma = new PrismaClient()

export async function GET(req) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query')?.trim()

    const staff = await prisma.user.findMany({
      where: {
        role: 'STAFF',
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          {
            staffOf: {
              some: {
                name: { contains: query, mode: 'insensitive' },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        staffOf: {
          select: {
            id: true,
            name: true,
          },
        },
        suspended: true,
        suspendedUntil: true,
        burned: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    })

    return NextResponse.json({ staff })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'ADMIN_SEARCH_STAFF' } })
    console.error('[ADMIN_SEARCH_STAFF]', error)
    return NextResponse.json({ error: 'Failed to search staff' }, { status: 500 })
  }
}
