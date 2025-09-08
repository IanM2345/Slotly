// apps/backend/src/app/api/search/route.js
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
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidUserId(userId) {
  return !!userId && /^[a-f\d]{24}$/i.test(userId);
}

// countFn: () => Promise<number>
// fetchFn: (skip:number, take:number) => Promise<Array<any>>
async function randomMany(countFn, fetchFn, take = 5) {
  const total = await countFn();
  if (!total) return [];
  const safeTake = Math.min(take, total);
  const maxSkip = Math.max(0, total - safeTake);
  const skip = Math.floor(Math.random() * (maxSkip + 1));
  return fetchFn(skip, safeTake);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceQuery = (searchParams.get('service') || '').trim();
    const q = serviceQuery;
    
    // Accept both 'lon' and 'lng' for compatibility
    const latRaw = searchParams.get('lat');
    const lonRaw = searchParams.get('lon') ?? searchParams.get('lng') ?? searchParams.get('longitude');
    
    const lat = parseFloat(String(latRaw));
    const lng = parseFloat(String(lonRaw));
    
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const time = (searchParams.get('time') || 'anytime').toLowerCase();
    const userId = searchParams.get('userId');
    const category = searchParams.get('category') || null;
    const kind = (searchParams.get('kind') || 'both').toLowerCase(); // 'services' | 'businesses' | 'both'
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10) || 30, 50);
    
    // Handle exact time filtering
    const startAtStr = searchParams.get('startAt');
    const startAt = startAtStr ? new Date(startAtStr) : null;
    const useExactSlot = !!(startAt && !Number.isNaN(startAt.getTime()));

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      console.warn('Bad /api/search coords', { latRaw, lonRaw, lat, lng });
      return NextResponse.json({ error: 'lat and lon/lng are required numbers' }, { status: 400 });
    }

    const range = timeRanges[time] || [0, 23];
    const startHour = range[0];
    const endHour = range[1];

    // recent search logging
    if (isValidUserId(userId) && q) {
      const existing = await prisma.recentSearch.findFirst({
        where: { userId: userId, service: q, latitude: lat, longitude: lng, category },
      });
      if (!existing) {
        await prisma.recentSearch.create({
          data: { userId: userId, service: q, latitude: lat, longitude: lng, category },
        });
      }
    }

    const wantServices = kind === 'both' || kind === 'services';
    const wantBusinesses = kind === 'both' || kind === 'businesses';

    const servicesPromise = (async () => {
      if (!wantServices) return [];
      const services = await prisma.service.findMany({
        where: {
          available: true,
          name: { contains: q, mode: 'insensitive' },
          ...(category ? { category } : {}),
        },
        include: {
          business: {
            select: {
              id: true, name: true, address: true, latitude: true, longitude: true, logoUrl: true, searchCount: true,
            },
          },
        },
        take: 200,
      });

      const withDist = services
        .map((s) => {
          const dKm = haversineDistance(lat, lng, s.business.latitude, s.business.longitude);
          return { s, dKm };
        })
        .filter((x) => x.dKm <= 10)
        .sort((a, b) => a.dKm - b.dKm)
        .slice(0, limit);

      const dateStart = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00Z`);
      const dateEnd = new Date(`${date}T${String(endHour).padStart(2, '0')}:59:59Z`);

      const counts = await Promise.all(
        withDist.map(({ s }) => {
          if (useExactSlot) {
            const slotEnd = new Date(startAt.getTime() + (s.duration || 0) * 60000);
            // overlap if: startTime < slotEnd && endTime > startAt
            return prisma.booking.count({
              where: {
                businessId: s.business.id,
                serviceId: s.id,
                startTime: { lt: slotEnd },
                endTime:   { gt: startAt },
              },
            });
          }
          // day-part heuristic
          return prisma.booking.count({
            where: {
              businessId: s.business.id,
              serviceId: s.id,
              startTime: { gte: dateStart, lte: dateEnd },
            },
          });
        })
      );

      const available = withDist
        .map((row, idx) => ({ ...row, count: counts[idx] }))
        .filter((row) => useExactSlot ? row.count === 0 : row.count < 5);

      Promise.allSettled(
        available.map((row) =>
          prisma.business.update({
            where: { id: row.s.business.id },
            data: { searchCount: { increment: 1 } },
          })
        )
      ).catch(() => {});

      return available
        .sort((a, b) => {
          const pop = (b.s.business.searchCount || 0) - (a.s.business.searchCount || 0);
          return pop !== 0 ? pop : a.dKm - b.dKm;
        })
        .map(({ s, dKm }) => ({
          id: s.id,
          name: s.name,
          price: s.price,
          duration: s.duration,
          category: s.category,
          business: {
            id: s.business.id,
            name: s.business.name,
            address: s.business.address,
            latitude: s.business.latitude,
            longitude: s.business.longitude,
            logoUrl: s.business.logoUrl || null,
          },
          distanceMeters: Math.round(dKm * 1000),
          mapsLink: `https://www.google.com/maps/search/?api=1&query=${s.business.latitude},${s.business.longitude}`,
        }));
    })();

    const businessesPromise = (async () => {
      if (!wantBusinesses) return [];
      const businesses = await prisma.business.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
          suspended: false,
          // Filter businesses by category through services
          ...(category ? { services: { some: { category } } } : {}),
        },
        select: {
          id: true, name: true, address: true, latitude: true, longitude: true, logoUrl: true, searchCount: true,
        },
        take: 300,
      });

      return businesses
        .map((b) => {
          const dKm = haversineDistance(lat, lng, b.latitude, b.longitude);
          return { b, dKm };
        })
        .filter((x) => x.dKm <= 10)
        .sort((a, b) => {
          const pop = (b.b.searchCount || 0) - (a.b.searchCount || 0);
          return pop !== 0 ? pop : a.dKm - b.dKm;
        })
        .slice(0, limit)
        .map(({ b, dKm }) => ({
          id: b.id,
          name: b.name,
          address: b.address,
          latitude: b.latitude,
          longitude: b.longitude,
          logoUrl: b.logoUrl || null,
          distanceMeters: Math.round(dKm * 1000),
        }));
    })();

    const [services, businesses] = await Promise.all([servicesPromise, businessesPromise]);

    const recentSearches = isValidUserId(userId)
      ? await prisma.recentSearch.findMany({
          where: { userId: userId },
          orderBy: { createdAt: 'desc' },
          take: 3,
        })
      : [];

    let suggestedBusinesses = [];
    let suggestedServices = [];
    if (!q) {
      suggestedBusinesses = await randomMany(
        () => prisma.business.count({ where: { suspended: false } }),
        (skip, take) =>
          prisma.business.findMany({
            where: { suspended: false },
            select: { id: true, name: true, address: true, latitude: true, longitude: true, logoUrl: true },
            skip,
            take,
          }),
        5
      );

      const svcRaw = await randomMany(
        () => prisma.service.count({ where: { available: true } }),
        (skip, take) =>
          prisma.service.findMany({
            where: { available: true },
            include: {
              business: {
                select: { id: true, name: true, address: true, latitude: true, longitude: true },
              },
            },
            skip,
            take,
          }),
        5
      );

      suggestedServices = svcRaw.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration: s.duration,
        business: s.business
          ? {
              id: s.business.id,
              name: s.business.name,
              address: s.business.address,
              latitude: s.business.latitude,
              longitude: s.business.longitude,
            }
          : undefined,
      }));
    }

    return NextResponse.json(
      {
        services,
        businesses,
        suggested: q
          ? undefined
          : {
              businesses: suggestedBusinesses,
              services: suggestedServices,
            },
        recentSearches: recentSearches.map((r) => ({
          service: r.service,
          latitude: r.latitude,
          longitude: r.longitude,
          category: r.category,
        })),
      },
      { status: 200 }
    );
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

    if (!isValidUserId(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    await prisma.recentSearch.deleteMany({ where: { userId } });

    return NextResponse.json({ message: 'Search history cleared' }, { status: 200 });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Failed to clear search history' }, { status: 500 });
  }
}