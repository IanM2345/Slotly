import '@/sentry.server.config'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'

const prisma = new PrismaClient()

export async function GET(request) {
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

    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId') || undefined
    const serviceId = searchParams.get('serviceId') || undefined
    const businessId = searchParams.get('businessId') || undefined
    const date = searchParams.get('date') || undefined // YYYY-MM-DD

    const where = {
      ...(businessId ? { businessId } : {}),
      ...(staffId ? { staffId } : {}),
      ...(serviceId ? { serviceId } : {}),
      ...(date
        ? {
            startTime: {
              gte: new Date(date + 'T00:00:00.000Z'),
              lt: new Date(date + 'T23:59:59.999Z'),
            },
          }
        : {}),
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        user: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, duration: true } },
      },
    })

    // ---------- Enrich: paidViaApp (avoid extra per-card request) ----------
    // Consider "paid via app" when there exists a SUCCESS payment with provider/txRef.
    const bookingIds = bookings.map(b => b.id)
    let successPayments = []
    if (bookingIds.length > 0) {
      successPayments = await prisma.payment.findMany({
        where: {
          bookingId: { in: bookingIds },
          status: 'SUCCESS',
        },
        select: { bookingId: true, provider: true, txRef: true },
      })
    }
    const paidViaAppSet = new Set(
      successPayments
        .filter(p => !!p.provider || !!p.txRef)
        .map(p => p.bookingId)
    )

    const enriched = bookings.map(b => ({
      ...b,
      paidViaApp: paidViaAppSet.has(b.id),
    }))
    // ----------------------------------------------------------------------

    return NextResponse.json({ bookings: enriched })
  } catch (error) {
    Sentry.captureException(error)
    console.error('GET /manager/bookings error:', error)
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

    switch (action) {
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
          where: { bookingId: booking.id, status: 'SUCCESS' },
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
