import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'

const prisma = new PrismaClient()

async function getBusinessFromToken(request) {
  // Use lowercase 'authorization' for consistency with clients
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Unauthorized', status: 401 }
  const token = authHeader.split(' ')[1]
  const { valid, decoded } = await verifyToken(token)
  if (!valid || decoded.role !== 'BUSINESS_OWNER') return { error: 'Unauthorized', status: 403 }
  const business = await prisma.business.findFirst({ where: { ownerId: decoded.userId } })
  if (!business) return { error: 'Business not found', status: 404 }
  return { business }
}

export async function POST(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request)
    if (error) return NextResponse.json({ error }, { status })

    const { serviceId, staffId } = await request.json()
    if (!serviceId || !staffId) {
      return NextResponse.json({ error: 'Missing serviceId or staffId' }, { status: 400 })
    }

    // Add helpful context to Sentry for this request
    Sentry.setContext('assignment', { businessId: business.id, serviceId, staffId })

    // Verify service belongs to business
    const svc = await prisma.service.findFirst({ where: { id: serviceId, businessId: business.id } })
    if (!svc) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

    // NEW: Verify staff is approved for this business
    const approved = await prisma.staffEnrollment.findFirst({
      where: { userId: staffId, businessId: business.id, status: 'APPROVED' },
      select: { id: true },
    })
    if (!approved) {
      return NextResponse.json(
        { error: 'Staff is not approved for this business' },
        { status: 403 }
      )
    }

    // Optional: Verify the user is actually a staff role
    const staffUser = await prisma.user.findUnique({ 
      where: { id: staffId }, 
      select: { role: true }
    })
    if (!staffUser || staffUser.role !== 'STAFF') {
      return NextResponse.json(
        { error: 'User is not a staff account' }, 
        { status: 400 }
      )
    }

    // Idempotent create (unique on [serviceId, staffId])
    await prisma.serviceStaff.upsert({
      where: { serviceId_staffId: { serviceId, staffId } },
      update: {},
      create: { businessId: business.id, serviceId, staffId },
    })

    return NextResponse.json({ message: 'Staff assigned' }, { status: 200 })
  } catch (e) {
    Sentry.captureException(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}