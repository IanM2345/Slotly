import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'

const prisma = new PrismaClient()

async function getBusinessFromToken(request) {
  // Use lowercase 'authorization' for consistency
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Unauthorized', status: 401 }
  const token = authHeader.split(' ')[1]
  const { valid, decoded } = await verifyToken(token)
  if (!valid || decoded.role !== 'BUSINESS_OWNER') return { error: 'Unauthorized', status: 403 }
  const business = await prisma.business.findFirst({ where: { ownerId: decoded.userId } })
  if (!business) return { error: 'Business not found', status: 404 }
  return { business }
}

export async function DELETE(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request)
    if (error) return NextResponse.json({ error }, { status })

    // Some clients dislike bodies on DELETE; support both body and query params
    let serviceId
    let staffId
    
    try {
      const body = await request.json()
      serviceId = body?.serviceId
      staffId = body?.staffId
    } catch {
      // If JSON parsing fails, try query params
    }
    
    // Fallback to query parameters if body parsing failed or values are missing
    const searchParams = new URL(request.url).searchParams
    serviceId = serviceId || searchParams.get('serviceId') || undefined
    staffId = staffId || searchParams.get('staffId') || undefined

    if (!serviceId || !staffId) {
      return NextResponse.json({ error: 'Missing serviceId or staffId' }, { status: 400 })
    }

    // Add context to Sentry for debugging
    Sentry.setContext('unassignment', { businessId: business.id, serviceId, staffId })

    // Verify service belongs to business
    const svc = await prisma.service.findFirst({ where: { id: serviceId, businessId: business.id } })
    if (!svc) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

    // Idempotent delete - won't error if assignment doesn't exist
    await prisma.serviceStaff.deleteMany({
      where: { businessId: business.id, serviceId, staffId },
    })

    return NextResponse.json({ message: 'Staff unassigned' }, { status: 200 })
  } catch (e) {
    Sentry.captureException(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}