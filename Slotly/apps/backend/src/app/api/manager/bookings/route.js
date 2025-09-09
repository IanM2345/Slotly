import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'

const prisma = new PrismaClient()

async function getBusinessForOwner(userId) {
  return prisma.business.findFirst({ where: { ownerId: userId }, select: { id: true } })
}

async function getBusinessForStaff(userId) {
  const se = await prisma.staffEnrollment.findFirst({
    where: { userId, status: 'APPROVED' },
    select: { businessId: true },
  })
  if (!se) return null
  return prisma.business.findUnique({ where: { id: se.businessId }, select: { id: true } })
}

async function resolveBusinessId(decoded, businessIdParam) {
  if (decoded.role === 'ADMIN') {
    if (!businessIdParam) return null
    const exists = await prisma.business.findUnique({ where: { id: businessIdParam }, select: { id: true } })
    return exists?.id ?? null
  }

  if (decoded.role === 'BUSINESS_OWNER') {
    if (businessIdParam) {
      const owned = await prisma.business.findFirst({
        where: { id: businessIdParam, ownerId: decoded.userId },
        select: { id: true },
      })
      return owned?.id ?? null
    }
    const biz = await getBusinessForOwner(decoded.userId)
    return biz?.id ?? null
  }

  if (decoded.role === 'STAFF') {
    const biz = await getBusinessForStaff(decoded.userId)
    return biz?.id ?? null
  }

  return null
}

export async function GET(request) {
  try {
    const auth = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = auth.split(' ')[1]
    const { valid, decoded } = await verifyToken(token)
    if (!valid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const businessIdParam = searchParams.get('businessId') || undefined
    const staffId = searchParams.get('staffId') || undefined
    const serviceId = searchParams.get('serviceId') || undefined
    const date = searchParams.get('date') || undefined // YYYY-MM-DD
    const view = (searchParams.get('view') || 'upcoming').toLowerCase()
    const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || 5)))

    const businessId = await resolveBusinessId(decoded, businessIdParam)
    if (!businessId) return NextResponse.json({ error: 'businessId not accessible' }, { status: 403 })

    const where = { businessId }
    if (staffId) where.staffId = staffId
    if (serviceId) where.serviceId = serviceId

    if (date) {
      where.startTime = {
        gte: new Date(`${date}T00:00:00.000Z`),
        lt: new Date(`${date}T23:59:59.999Z`),
      }
    } else if (view === 'upcoming') {
      where.startTime = { gte: new Date() }
    }

    const rows = await prisma.booking.findMany({
      where,
      orderBy: { startTime: 'asc' },
      take: limit,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        service: { select: { id: true, name: true, price: true } },
        user: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
        // grab the latest successful in-app payment (if any)
        payments: {
          where: {
            type: 'BOOKING',             // Fixed: was context: 'BOOKING'
            status: 'SUCCESS',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            method: true,
            provider: true,
            txRef: true,
            amount: true,
          },
        }
      },
    })

    const bookings = rows.map(b => {
      const p = b.payments?.[0] || null
      return {
        id: b.id,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        service: b.service,
        user: b.user,
        staff: b.staff,
        isPaid: !!p,
        paidChannel: p?.method || null,
        paidViaApp: !!(p?.provider || p?.txRef),
        price: b.service?.price ?? null,
      }
    })

    return NextResponse.json({ businessId, bookings }, { status: 200 })
  } catch (err) {
    Sentry.captureException(err)
    console.error('GET /manager/bookings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


export async function PATCH(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { valid, decoded } = await verifyToken(token)
    if (!valid || (decoded.role !== 'ADMIN' && decoded.role !== 'BUSINESS_OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, id, reason, startTime, staffId } = body || {}
    if (!action || !id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: true,
        staff: true,
        service: true,
      },
    })
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Owner guard: ensure they can only mutate their own business' booking
    if (decoded.role === 'BUSINESS_OWNER') {
      const biz = await getBusinessForOwner(decoded.userId)
      if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })
      if (booking.businessId !== biz.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    switch (action) {
      case 'complete': {
        // cannot complete if already terminal
        if (['CANCELLED','COMPLETED','NO_SHOW'].includes(booking.status)) {
          return NextResponse.json({ error: 'Booking already finalized' }, { status: 400 })
        }
        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            markedById: decoded.userId,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            staff:{ select: { id: true, name: true } },
            service:{ select: { id: true, name: true } },
          },
        })
        return NextResponse.json({ message: 'Marked as completed', booking: updated }, { status: 200 })
      }

      case 'noShow': {
        if (['CANCELLED','COMPLETED','NO_SHOW'].includes(booking.status)) {
          return NextResponse.json({ error: 'Booking already finalized' }, { status: 400 })
        }
        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'NO_SHOW',
            noShowAt: new Date(),
            markedById: decoded.userId,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            staff:{ select: { id: true, name: true } },
            service:{ select: { id: true, name: true } },
          },
        })
        return NextResponse.json({ message: 'Marked as no-show', booking: updated }, { status: 200 })
      }

      case 'reassign': {
        if (!staffId) {
          return NextResponse.json({ error: 'Missing staffId' }, { status: 400 })
        }
        const updated = await prisma.booking.update({
          where: { id },
          data: { staffId },
          include: {
            user: { select: { id: true, name: true, email: true } },
            staff: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        })
        return NextResponse.json({ message: 'Reassigned', booking: updated }, { status: 200 })
      }

      case 'reschedule': {
        if (!startTime) {
          return NextResponse.json({ error: 'Missing startTime' }, { status: 400 })
        }
        const newStart = new Date(startTime)
        if (Number.isNaN(newStart.getTime())) {
          return NextResponse.json({ error: 'Invalid startTime' }, { status: 400 })
        }
        const durationMin = booking?.service?.duration ?? 0
        const newEnd = new Date(newStart.getTime() + durationMin * 60000)
        const updated = await prisma.booking.update({
          where: { id },
          data: {
            startTime: newStart,
            endTime: newEnd,
            status: booking.status === 'PENDING' ? 'RESCHEDULED' : booking.status,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            staff: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        })
        return NextResponse.json({ message: 'Rescheduled', booking: updated }, { status: 200 })
      }

      case 'cancel': {
        // ---------- Refund-first cancellation ----------
        // 1) Block cancelling completed or no-show
        if (booking.status === 'COMPLETED' || booking.status === 'NO_SHOW') {
          return NextResponse.json(
            { error: 'Cannot cancel a completed or no-show booking' },
            { status: 400 }
          )
        }

        // 2) Look for successful in-app payment (paid via app if provider/txRef present)
        const pay = await prisma.payment.findFirst({
          where: { 
            bookingId: booking.id, 
            status: 'SUCCESS',
            type: 'BOOKING', // Fixed: was context: 'BOOKING'
          },
        })
        const isAppPayment = !!pay?.provider || !!pay?.txRef

        // 3) Late-cancellation window check
        const minutesBeforeStart = Math.ceil(
          (new Date(booking.startTime).getTime() - Date.now()) / 60000
        )
        const pastDeadline =
          minutesBeforeStart < (booking.cancellationDeadlineMinutes ?? 120)

        // 4) Compute refund (full minus optional late-cancel fee)
        let refundAmount = 0
        if (isAppPayment && pay) {
          refundAmount = pay.amount
          if (pastDeadline && booking.lateCancellationFee && booking.lateCancellationFee > 0) {
            refundAmount = Math.max(0, refundAmount - booking.lateCancellationFee)
          }

          // 5) TODO: Call IntaSend (or PSP) refund API here and capture a reference
          // await refundViaIntaSend({
          //   providerPaymentId: pay.providerPaymentId, // or txRef
          //   amount: refundAmount,
          // })

          // 6) Mark payment as REFUNDED (and optionally store refund reference/metadata)
          await prisma.payment.update({
            where: { id: pay.id },
            data: { status: 'REFUNDED' },
          })
        }

        // 7) Finally cancel the booking
        const updated = await prisma.booking.update({
          where: { id },
          data: { status: 'CANCELLED', cancelReason: reason ?? null },
          include: {
            user: { select: { id: true, name: true, email: true } },
            staff: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        })

        const msg = isAppPayment
          ? `Cancelled and refunded KSh ${Number(refundAmount).toLocaleString()}`
          : 'Cancelled'

        return NextResponse.json({ message: msg, booking: updated }, { status: 200 })
        // ------------------------------------------------
      }

      default:
        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }
  } catch (error) {
    Sentry.captureException(error)
    console.error('PATCH /manager/bookings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}