import { PrismaClient } from '@/generated/prisma';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

const timeRanges = {
  morning: [6, 12],
  afternoon: [12, 17],
  evening: [17, 23],
  anytime: [0, 23],
};

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isValidUserId(userId) {
  return /^[a-f\d]{24}$/i.test(userId); // MongoDB ObjectId format
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceQuery = searchParams.get('service') || '';
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lon'));
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const time = searchParams.get('time') || 'anytime';
    const userId = searchParams.get('userId');
    const category = searchParams.get('category') || null;

    const [startHour, endHour] = timeRanges[time.toLowerCase()] || [0, 23];

    // Save recent search only if not a duplicate
    if (userId && isValidUserId(userId)) {
      const existing = await prisma.recentSearch.findFirst({
        where: {
          userId,
          service: serviceQuery,
          latitude: lat,
          longitude: lng,
          category,
        },
      });

      if (!existing) {
        await prisma.recentSearch.create({
          data: {
            userId,
            service: serviceQuery,
            latitude: lat,
            longitude: lng,
            category,
          },
        });
      }
    }

    // Fetch available services with optional category
    const services = await prisma.service.findMany({
      where: {
        name: {
          contains: serviceQuery,
          mode: 'insensitive',
        },
        available: true,
        ...(category && { category }),
      },
      include: {
        business: true,
      },
    });

    // Filter services within 10 km
    const nearbyServices = services.filter(service => {
      const distance = haversineDistance(lat, lng, service.business.latitude, service.business.longitude);
      return distance <= 10;
    });

    const results = [];

    for (const service of nearbyServices) {
      const bookings = await prisma.booking.findMany({
        where: {
          businessId: service.business.id,
          serviceId: service.id,
          startTime: {
            gte: new Date(`${date}T${startHour.toString().padStart(2, '0')}:00:00Z`),
            lte: new Date(`${date}T${endHour.toString().padStart(2, '0')}:59:59Z`),
          },
        },
      });

      const hasAvailability = bookings.length < 5;

      if (hasAvailability) {
        await prisma.business.update({
          where: { id: service.business.id },
          data: {
            searchCount: {
              increment: 1,
            },
          },
        });

        results.push({
          business: {
            ...service.business,
            searchCount: service.business.searchCount + 1,
          },
          service: {
            id: service.id,
            name: service.name,
            description: service.description,
            price: service.price,
            duration: service.duration,
            category: service.category,
          },
          location: {
            latitude: service.business.latitude,
            longitude: service.business.longitude,
          },
          mapsLink: `https://www.google.com/maps/search/?api=1&query=${service.business.latitude},${service.business.longitude}`,
        });
      }
    }

    results.sort((a, b) => {
      if (b.business.searchCount !== a.business.searchCount) {
        return b.business.searchCount - a.business.searchCount;
      }
      const distA = haversineDistance(lat, lng, a.location.latitude, a.location.longitude);
      const distB = haversineDistance(lat, lng, b.location.latitude, b.location.longitude);
      return distA - distB;
    });

   
    let recentSearches = [];
    if (userId && isValidUserId(userId)) {
      recentSearches = await prisma.recentSearch.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });
    }

    return NextResponse.json({
      results,
      recentSearches: recentSearches.map(search => ({
        service: search.service,
        latitude: search.latitude,
        longitude: search.longitude,
        category: search.category,
      })),
    }, { status: 200 });

  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error in search API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || !isValidUserId(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    await prisma.recentSearch.deleteMany({ where: { userId } });

    return NextResponse.json({ message: 'Search history cleared' }, { status: 200 });

  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Failed to clear search history' }, { status: 500 });
  }
}
