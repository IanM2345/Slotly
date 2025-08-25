// apps/backend/src/app/api/admin/businesses/route.js
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { requireAuth } from '@/lib/token';

const prisma = globalThis.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;

function ensureAdmin(user) {
  const role = String(user?.role || '').toUpperCase();
  return ['ADMIN', 'SUPER_ADMIN', 'CREATOR'].includes(role);
}

export async function GET(request) {
  let admin;
  try {
    admin = await requireAuth(request);
    if (!ensureAdmin(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') || 'PENDING').toUpperCase();
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const pageSize = Math.min(Math.max(1, Number(searchParams.get('pageSize') || '20')), 100);
    const query = (searchParams.get('query') || '').trim();
    const suspended = searchParams.get('suspended');

    // Build where clause
    const where = {};
    
    // Handle suspension filter
    if (suspended === 'true') {
      where.suspended = true;
    } else if (suspended === 'false') {
      where.suspended = false;
    }

    // Handle verification status filter - Multiple approaches for MongoDB compatibility
    if (status && status !== 'ALL') {
      if (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED') {
        // Try different approaches for MongoDB + Prisma
        try {
          // Approach 1: Direct filtering (might work in newer Prisma versions)
          where.verification = {
            status: status
          };
        } catch (err) {
          console.log('Direct filtering failed, trying alternative approach');
          // Approach 2: Using 'is' operator
          where.verification = {
            is: {
              status: status
            }
          };
        }
      } else if (status === 'NO_VERIFICATION') {
        where.verification = null;
      }
    }

    // Handle search query
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { owner: { email: { contains: query, mode: 'insensitive' } } },
        { owner: { name: { contains: query, mode: 'insensitive' } } },
      ];
    }

    console.log('Prisma where clause:', JSON.stringify(where, null, 2));

    // First, try the query as constructed
    let total, rows;
    try {
      [total, rows] = await Promise.all([
        prisma.business.count({ where }),
        prisma.business.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            owner: {
              select: { 
                id: true, 
                email: true, 
                name: true, 
                phone: true, 
                createdAt: true 
              }
            },
            verification: {
              select: { 
                id: true, 
                status: true, 
                createdAt: true, 
                reviewedAt: true 
              }
            },
            subscription: {
              select: { 
                id: true, 
                plan: true, 
                isActive: true, 
                startDate: true, 
                endDate: true 
              }
            },
            _count: {
              select: {
                services: true,
                adCampaigns: true,
                staffEnrollments: true,
                bookings: true,
                reviews: true,
                coupons: true,
                addOns: true,
              }
            }
          }
        })
      ]);
    } catch (queryError) {
      console.log('Primary query failed, trying fallback without verification filter:', queryError);
      
      // Fallback: Remove verification filter and filter results in memory
      const fallbackWhere = { ...where };
      delete fallbackWhere.verification;
      
      const [fallbackTotal, fallbackRows] = await Promise.all([
        prisma.business.count({ where: fallbackWhere }),
        prisma.business.findMany({
          where: fallbackWhere,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: 0, // Get all for filtering
          take: 1000, // Reasonable limit
          include: {
            owner: {
              select: { 
                id: true, 
                email: true, 
                name: true, 
                phone: true, 
                createdAt: true 
              }
            },
            verification: {
              select: { 
                id: true, 
                status: true, 
                createdAt: true, 
                reviewedAt: true 
              }
            },
            subscription: {
              select: { 
                id: true, 
                plan: true, 
                isActive: true, 
                startDate: true, 
                endDate: true 
              }
            },
            _count: {
              select: {
                services: true,
                adCampaigns: true,
                staffEnrollments: true,
                bookings: true,
                reviews: true,
                coupons: true,
                addOns: true,
              }
            }
          }
        })
      ]);
      
      // Filter in memory based on verification status
      let filteredRows = fallbackRows;
      if (status && status !== 'ALL') {
        filteredRows = fallbackRows.filter(business => {
          if (status === 'NO_VERIFICATION') {
            return !business.verification;
          } else {
            return business.verification?.status === status;
          }
        });
      }
      
      // Apply pagination to filtered results
      total = filteredRows.length;
      rows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
      
      console.log(`Fallback query successful: ${total} total, ${rows.length} on page ${page}`);
    }

    const items = rows.map(b => ({
      id: b.id,
      name: b.name,
      description: b.description,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      suspended: b.suspended,
      suspendedUntil: b.suspendedUntil,
      owner: b.owner,
      verification: b.verification
        ? {
            id: b.verification.id,
            status: String(b.verification.status).toLowerCase(),
            createdAt: b.verification.createdAt,
            updatedAt: b.verification.reviewedAt ?? b.verification.createdAt,
          }
        : null,
      subscription: b.subscription,
      stats: {
        services: b._count.services,
        campaigns: b._count.adCampaigns,
        staff: b._count.staffEnrollments,
        bookings: b._count.bookings,
        reviews: b._count.reviews,
        coupons: b._count.coupons,
        addOns: b._count.addOns,
      }
    }));

    return NextResponse.json({
      items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPrevPage: page > 1,
      },
      filters: { status: status.toLowerCase(), suspended, query },
    });
  } catch (err) {
    console.error('GET /api/admin/businesses failed:', err);
    console.error('Error details:', {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
      cause: err?.cause,
      code: err?.code, // Prisma error codes
      meta: err?.meta  // Additional Prisma error metadata
    });
    
    Sentry.captureException(err, { 
      extra: { 
        route: 'GET /api/admin/businesses', 
        adminId: admin?.id,
        errorDetails: {
          message: err?.message,
          name: err?.name,
          code: err?.code,
          meta: err?.meta
        }
      } 
    });
    
    return NextResponse.json({ 
      error: err?.message || 'Failed to fetch businesses',
      details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    }, { status: 500 });
  }
}