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
  const R = 6371; // Earth's radius in km
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidUserId(userId) {
  return !!userId && /^[a-f\d]{24}$/i.test(userId);
}

function parseCoordinates(latRaw, lonRaw) {
  const lat = parseFloat(String(latRaw || ''));
  const lng = parseFloat(String(lonRaw || ''));
  
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { valid: false, lat: null, lng: null };
  }
  
  // Basic coordinate validation
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, lat: null, lng: null };
  }
  
  return { valid: true, lat, lng };
}

// Enhanced random selection with better distribution
async function randomMany(countFn, fetchFn, take = 5) {
  try {
    const total = await countFn();
    if (!total || total === 0) {
      console.log('No records found for random selection');
      return [];
    }
    
    const safeTake = Math.min(take, total);
    const maxSkip = Math.max(0, total - safeTake);
    const skip = Math.floor(Math.random() * (maxSkip + 1));
    
    const results = await fetchFn(skip, safeTake);
    return results || [];
  } catch (error) {
    console.error('Error in randomMany:', error);
    return [];
  }
}

export async function GET(request) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract and normalize parameters
    const serviceQuery = (searchParams.get('service') || '').trim();
    const q = serviceQuery;
    
    // Accept multiple coordinate parameter names for compatibility
    const latRaw = searchParams.get('lat') || searchParams.get('latitude');
    const lonRaw = searchParams.get('lon') || 
                   searchParams.get('lng') || 
                   searchParams.get('longitude');
    
    // Parse and validate coordinates
    const { valid: coordsValid, lat, lng } = parseCoordinates(latRaw, lonRaw);
    
    if (!coordsValid) {
      console.warn('Invalid coordinates in search request:', { 
        latRaw, 
        lonRaw, 
        parsed: { lat, lng } 
      });
      return NextResponse.json({ 
        error: 'Valid latitude and longitude coordinates are required',
        details: 'lat must be between -90 and 90, lon/lng must be between -180 and 180'
      }, { status: 400 });
    }
    
    // Parse other parameters with defaults
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const time = (searchParams.get('time') || 'anytime').toLowerCase();
    const userId = searchParams.get('userId');
    const category = searchParams.get('category') || null;
    const kind = (searchParams.get('kind') || 'both').toLowerCase();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '30', 10) || 30, 1), 100);
    const maxDistance = Math.min(parseFloat(searchParams.get('maxDistance') || '25'), 50); // km, max 50km
    
    // Enhanced exact time filtering
    const startAtStr = searchParams.get('startAt');
    const startAt = startAtStr ? new Date(startAtStr) : null;
    const useExactSlot = !!(startAt && !Number.isNaN(startAt.getTime()));
    
    console.log('Search request:', {
      query: q,
      coordinates: { lat, lng },
      kind,
      limit,
      maxDistance,
      category,
      useExactSlot,
      userId: userId ? 'provided' : 'none'
    });

    // Validate time range
    const range = timeRanges[time] || [0, 23];
    const startHour = range[0];
    const endHour = range[1];

    // Log recent searches for valid users
    if (isValidUserId(userId) && q) {
      try {
        const existing = await prisma.recentSearch.findFirst({
          where: { 
            userId: userId, 
            service: q, 
            latitude: lat, 
            longitude: lng, 
            category 
          },
        });
        
        if (!existing) {
          await prisma.recentSearch.create({
            data: { 
              userId: userId, 
              service: q, 
              latitude: lat, 
              longitude: lng, 
              category 
            },
          });
        }
      } catch (recentSearchError) {
        console.warn('Failed to log recent search:', recentSearchError.message);
        // Don't fail the entire request for this
      }
    }

    // Determine what to search for
    const wantServices = kind === 'both' || kind === 'services';
    const wantBusinesses = kind === 'both' || kind === 'businesses';

    // Enhanced services search
    const servicesPromise = (async () => {
      if (!wantServices) return [];
      
      try {
        console.log('Searching services with query:', q);
        
        const whereClause = {
          available: true,
          ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
          ...(category ? { category } : {}),
        };
        
        const services = await prisma.service.findMany({
          where: whereClause,
          include: {
            business: {
              select: {
                id: true, 
                name: true, 
                address: true, 
                latitude: true, 
                longitude: true, 
                logoUrl: true, 
                searchCount: true,
                suspended: true,
              },
            },
          },
          take: 500, // Increased to allow for distance filtering
        });

        console.log(`Found ${services.length} services before distance filtering`);

        // Filter by distance and sort
        const withDistance = services
          .filter(s => s.business && !s.business.suspended) // Ensure business exists and is not suspended
          .map((s) => {
            const dKm = haversineDistance(lat, lng, s.business.latitude, s.business.longitude);
            return { s, dKm };
          })
          .filter((x) => x.dKm <= maxDistance)
          .sort((a, b) => a.dKm - b.dKm)
          .slice(0, limit);

        console.log(`${withDistance.length} services within ${maxDistance}km`);

        if (withDistance.length === 0) {
          return [];
        }

        // Check availability based on time constraints
        const dateStart = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00Z`);
        const dateEnd = new Date(`${date}T${String(endHour).padStart(2, '0')}:59:59Z`);

        const availabilityChecks = await Promise.allSettled(
          withDistance.map(({ s }) => {
            if (useExactSlot) {
              const slotEnd = new Date(startAt.getTime() + (s.duration || 60) * 60000);
              return prisma.booking.count({
                where: {
                  businessId: s.business.id,
                  serviceId: s.id,
                  startTime: { lt: slotEnd },
                  endTime: { gt: startAt },
                },
              });
            }
            
            // Day-part availability check
            return prisma.booking.count({
              where: {
                businessId: s.business.id,
                serviceId: s.id,
                startTime: { gte: dateStart, lte: dateEnd },
              },
            });
          })
        );

        const counts = availabilityChecks.map(result => 
          result.status === 'fulfilled' ? result.value : 999 // Treat failed checks as unavailable
        );

        // Filter available services
        const available = withDistance
          .map((row, idx) => ({ ...row, bookingCount: counts[idx] }))
          .filter((row) => useExactSlot ? row.bookingCount === 0 : row.bookingCount < 10); // Increased threshold

        console.log(`${available.length} services available for requested time`);

        // Update search counts asynchronously (don't wait for completion)
        Promise.allSettled(
          available.map((row) =>
            prisma.business.update({
              where: { id: row.s.business.id },
              data: { searchCount: { increment: 1 } },
            }).catch(() => {}) // Ignore failures
          )
        );

        // Sort by popularity then distance
        return available
          .sort((a, b) => {
            const popDiff = (b.s.business.searchCount || 0) - (a.s.business.searchCount || 0);
            return popDiff !== 0 ? popDiff : a.dKm - b.dKm;
          })
          .map(({ s, dKm }) => ({
            id: s.id,
            name: s.name,
            price: s.price,
            duration: s.duration,
            category: s.category,
            description: s.description || null,
            business: {
              id: s.business.id,
              name: s.business.name,
              address: s.business.address,
              latitude: s.business.latitude,
              longitude: s.business.longitude,
              logoUrl: s.business.logoUrl || null,
            },
            distanceMeters: Math.round(dKm * 1000),
            distanceKm: Math.round(dKm * 10) / 10, // Rounded to 1 decimal
            mapsLink: `https://www.google.com/maps/search/?api=1&query=${s.business.latitude},${s.business.longitude}`,
          }));
          
      } catch (error) {
        console.error('Error searching services:', error);
        Sentry.captureException?.(error);
        return [];
      }
    })();

    // Enhanced businesses search
    const businessesPromise = (async () => {
      if (!wantBusinesses) return [];
      
      try {
        console.log('Searching businesses with query:', q);
        
        const whereClause = {
          suspended: false,
          ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
          // Filter businesses by category through services if category is specified
          ...(category ? { 
            services: { 
              some: { 
                category,
                available: true 
              } 
            } 
          } : {}),
        };
        
        const businesses = await prisma.business.findMany({
          where: whereClause,
          select: {
            id: true, 
            name: true, 
            address: true, 
            latitude: true, 
            longitude: true, 
            logoUrl: true, 
            searchCount: true,
            description: true,
            phone: true,
          },
          take: 500,
        });

        console.log(`Found ${businesses.length} businesses before distance filtering`);

        const filtered = businesses
          .map((b) => {
            const dKm = haversineDistance(lat, lng, b.latitude, b.longitude);
            return { b, dKm };
          })
          .filter((x) => x.dKm <= maxDistance)
          .sort((a, b) => {
            const popDiff = (b.b.searchCount || 0) - (a.b.searchCount || 0);
            return popDiff !== 0 ? popDiff : a.dKm - b.dKm;
          })
          .slice(0, limit);

        console.log(`${filtered.length} businesses within ${maxDistance}km`);

        return filtered.map(({ b, dKm }) => ({
          id: b.id,
          name: b.name,
          address: b.address,
          latitude: b.latitude,
          longitude: b.longitude,
          logoUrl: b.logoUrl || null,
          description: b.description || null, // placeholder until you add a public business phone field
          distanceMeters: Math.round(dKm * 1000),
          distanceKm: Math.round(dKm * 10) / 10,
          mapsLink: `https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`,
        }));
        
      } catch (error) {
        console.error('Error searching businesses:', error);
        Sentry.captureException?.(error);
        return [];
      }
    })();

    // Execute searches in parallel
    const [services, businesses] = await Promise.all([servicesPromise, businessesPromise]);

    // Get recent searches for authenticated users
    let recentSearches = [];
    if (isValidUserId(userId)) {
      try {
        recentSearches = await prisma.recentSearch.findMany({
          where: { userId: userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
      } catch (error) {
        console.warn('Failed to fetch recent searches:', error.message);
      }
    }

    // Get suggestions when no query is provided
    let suggestedBusinesses = [];
    let suggestedServices = [];
    
    if (!q) {
      try {
        console.log('Fetching suggestions...');
        
        // Get random businesses near the location
        const nearbyBusinesses = await prisma.business.findMany({
          where: { 
            suspended: false,
            // Rough bounding box for better performance
            latitude: { gte: lat - 0.5, lte: lat + 0.5 },
            longitude: { gte: lng - 0.5, lte: lng + 0.5 },
          },
          select: { 
            id: true, 
            name: true, 
            address: true, 
            latitude: true, 
            longitude: true, 
            logoUrl: true 
          },
          take: 20,
        });
        
        suggestedBusinesses = nearbyBusinesses
          .map(b => ({
            ...b,
            dKm: haversineDistance(lat, lng, b.latitude, b.longitude)
          }))
          .filter(b => b.dKm <= maxDistance)
          .sort((a, b) => a.dKm - b.dKm)
          .slice(0, 5);

        // Get random services
        const nearbyServices = await prisma.service.findMany({
          where: { 
            available: true,
            business: {
              suspended: false,
              latitude: { gte: lat - 0.5, lte: lat + 0.5 },
              longitude: { gte: lng - 0.5, lte: lng + 0.5 },
            }
          },
          include: {
            business: {
              select: { 
                id: true, 
                name: true, 
                address: true, 
                latitude: true, 
                longitude: true,
                logoUrl: true
              },
            },
          },
          take: 20,
        });

        suggestedServices = nearbyServices
          .map(s => ({
            ...s,
            dKm: haversineDistance(lat, lng, s.business.latitude, s.business.longitude)
          }))
          .filter(s => s.dKm <= maxDistance)
          .sort((a, b) => a.dKm - b.dKm)
          .slice(0, 5)
          .map((s) => ({
            id: s.id,
            name: s.name,
            price: s.price,
            duration: s.duration,
            category: s.category,
            business: s.business,
            distanceMeters: Math.round(s.dKm * 1000),
          }));
          
        console.log(`Found ${suggestedBusinesses.length} suggested businesses, ${suggestedServices.length} suggested services`);
        
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        // Don't fail the request for suggestions
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`Search completed in ${processingTime}ms:`, {
      services: services.length,
      businesses: businesses.length,
      suggestedBusinesses: suggestedBusinesses.length,
      suggestedServices: suggestedServices.length,
      recentSearches: recentSearches.length
    });

    const response = {
      services,
      businesses,
      suggested: q ? undefined : {
        businesses: suggestedBusinesses,
        services: suggestedServices,
      },
      recentSearches: recentSearches.map((r) => ({
        service: r.service,
        latitude: r.latitude,
        longitude: r.longitude,
        category: r.category,
        createdAt: r.createdAt,
      })),
      meta: {
        query: q,
        coordinates: { lat, lng },
        maxDistance,
        processingTime,
        kind,
        resultsCount: {
          services: services.length,
          businesses: businesses.length,
        }
      }
    };

    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Critical error in search API:', {
      error: error.message,
      stack: error.stack,
      processingTime
    });
    
    Sentry.captureException?.(error);
    
    return NextResponse.json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Search temporarily unavailable'
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!isValidUserId(userId)) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    const deleteResult = await prisma.recentSearch.deleteMany({ 
      where: { userId } 
    });

    console.log(`Cleared ${deleteResult.count} recent searches for user ${userId}`);

    return NextResponse.json({ 
      message: 'Search history cleared successfully',
      deletedCount: deleteResult.count
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error clearing search history:', error);
    Sentry.captureException?.(error);
    return NextResponse.json({ 
      error: 'Failed to clear search history',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Operation failed'
    }, { status: 500 });
  }
}