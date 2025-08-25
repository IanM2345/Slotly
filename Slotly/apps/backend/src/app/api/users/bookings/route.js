import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

// Helper function to safely extract user ID from decoded token
function extractUserId(decoded) {
  // Try common JWT payload fields for user ID
  return (
    decoded.userId ??
    decoded.id ??
    decoded.sub ??
    decoded._id ??
    decoded.user_id ??
    decoded.user?.id ??
    decoded.user?.userId ??
    null
  );
}

// Helper function to transform booking data with backward-compatible imageUrl
function transformBooking(booking) {
  if (!booking.service) return booking;
  
  const imageUrl = booking.service.serviceImages?.[0]?.url ?? null;
  
  return {
    ...booking,
    service: {
      ...booking.service,
      imageUrl, // backward-compatible field for clients
      // Remove serviceImages array to keep response clean
      serviceImages: undefined
    }
  };
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || !decoded || decoded.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = extractUserId(decoded);
    
    if (!userId) {
      console.error('No user ID found in token payload:', {
        decodedKeys: Object.keys(decoded),
        decoded: decoded
      });
      return NextResponse.json({ error: 'Unauthorized - invalid token payload' }, { status: 401 });
    }

    console.log(`Fetching bookings for user: ${userId}`);

    const now = new Date();

    // Base include object with correct field names
    const baseInclude = {
      service: {
        select: {
          id: true,
          name: true,
          duration: true,
          price: true,
          serviceImages: {
            select: { url: true },
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        }
      },
      business: true,
      payments: true,
      reminder: true,
    };

    const upcomingBookings = await prisma.booking.findMany({
      where: {
        userId,
        startTime: { gt: now },
      },
      include: baseInclude,
      orderBy: { startTime: 'asc' },
    });

    const pastBookings = await prisma.booking.findMany({
      where: {
        userId,
        endTime: { lt: now },
      },
      include: baseInclude,
      orderBy: { endTime: 'desc' },
    });

    // Transform bookings to include backward-compatible imageUrl
    const transformedUpcoming = upcomingBookings.map(transformBooking);
    const transformedPast = pastBookings.map(transformBooking);

    return NextResponse.json({ 
      upcomingBookings: transformedUpcoming, 
      pastBookings: transformedPast 
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || !decoded || decoded.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = extractUserId(decoded);
    
    if (!userId) {
      console.error('No user ID found in token payload:', {
        decodedKeys: Object.keys(decoded),
        decoded: decoded
      });
      return NextResponse.json({ error: 'Unauthorized - invalid token payload' }, { status: 401 });
    }

    const body = await request.json();
    const {
      serviceId,
      businessId,
      startTime,
      endTime,
      status,
      couponCode,
    } = body;

    // ✅ Removed paymentMethod and mpesaPhone from destructuring since they're not part of Booking model

    // Validate required fields
    if (!serviceId || !businessId || !startTime || !endTime) {
      return NextResponse.json({ 
        error: 'Missing required booking fields',
        received: { serviceId: !!serviceId, businessId: !!businessId, startTime: !!startTime, endTime: !!endTime }
      }, { status: 400 });
    }

    // Validate time format and range
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ 
        error: 'Invalid date format',
        received: { startTime, endTime }
      }, { status: 400 });
    }

    if (start >= end) {
      return NextResponse.json({ 
        error: 'Start time must be before end time',
        received: { startTime: start.toISOString(), endTime: end.toISOString() }
      }, { status: 400 });
    }

    // Validate that the service exists and belongs to the business
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, businessId: true, name: true }
    });

    if (!service) {
      return NextResponse.json({ 
        error: 'Service not found',
        serviceId 
      }, { status: 404 });
    }

    if (service.businessId !== businessId) {
      return NextResponse.json({ 
        error: 'Service does not belong to the specified business',
        serviceBusinessId: service.businessId,
        requestedBusinessId: businessId
      }, { status: 400 });
    }

    // Validate business exists
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true }
    });

    if (!business) {
      return NextResponse.json({ 
        error: 'Business not found',
        businessId 
      }, { status: 404 });
    }

    console.log('Creating booking:', {
      userId,
      serviceId,
      serviceName: service.name,
      businessId,
      businessName: business.name,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: status || 'PENDING'
    });

    // Handle coupon logic
    let appliedCoupon = null;
    if (couponCode) {
      appliedCoupon = await prisma.userCoupon.findFirst({
        where: {
          userId,
          coupon: {
            code: couponCode,
            businessId,
            expiresAt: { gt: new Date() },
          },
          usedAt: null,
        },
        include: { coupon: true },
      });

      if (!appliedCoupon) {
        return NextResponse.json({ error: 'Invalid or already used coupon' }, { status: 400 });
      }
    }

    // Create the booking with only valid Booking model fields
    const bookingData = {
      userId,                           // Now guaranteed to exist
      serviceId,
      businessId,
      startTime: start,
      endTime: end,
      status: status || 'PENDING',
      couponId: appliedCoupon?.couponId ?? null,
    };

    // ✅ Removed paymentMethod and mpesaPhone fields - they don't exist in Booking model
    // Payment processing should be handled separately with Payment model

    const newBooking = await prisma.booking.create({
      data: bookingData,
      include: {
        service: {
          select: {
            id: true,
            name: true,
            duration: true,
            price: true,
            serviceImages: {
              select: { url: true },
              take: 1,
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        business: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            logoUrl: true,
          }
        },
        payments: true,
        reminder: true,
        coupon: true,
      },
    });

    // Handle coupon usage in transaction
    if (appliedCoupon) {
      await prisma.$transaction([
        prisma.userCoupon.update({
          where: { id: appliedCoupon.id },
          data: { usedAt: new Date() },
        }),
        prisma.coupon.update({
          where: { id: appliedCoupon.couponId },
          data: { timesUsed: { increment: 1 } },
        }),
      ]);
    }

    console.log('Booking created successfully:', {
      bookingId: newBooking.id,
      userId: newBooking.userId,
      serviceId: newBooking.serviceId,
      businessId: newBooking.businessId
    });

    // Transform the response to include backward-compatible imageUrl
    const transformedBooking = transformBooking(newBooking);

    return NextResponse.json(transformedBooking, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    
    // Enhanced error logging
    if (error.code === 'P2002') {
      console.error('Unique constraint violation:', error.meta);
    } else if (error.code === 'P2003') {
      console.error('Foreign key constraint violation:', error.meta);
    } else if (error.code === 'P2025') {
      console.error('Record not found:', error.meta);
    }
    
    Sentry.captureException(error);
    
    // Return more specific error messages in development
    const isDev = process.env.NODE_ENV === 'development';
    
    return NextResponse.json({ 
      error: isDev ? error.message : 'Internal Server Error',
      ...(isDev && { 
        code: error.code,
        details: error.meta,
        stack: error.stack?.split('\n').slice(0, 5)
      })
    }, { status: 500 });
  }
}