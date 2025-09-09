import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

// ✅ Reuse Prisma in dev to avoid too many clients
const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis._prisma = prisma;

export const dynamic = 'force-dynamic';

// --- Helper Functions ---
const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

const pick = (obj, keys) =>
  Object.fromEntries(
    keys
      .map((k) => (obj?.[k] !== undefined ? [k, obj[k]] : null))
      .filter(Boolean)
  );

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Map Prisma errors to HTTP responses
function prismaToHttp(err) {
  // P2025: record not found
  if (err?.code === 'P2025') return jsonError('Business not found', 404);
  // P2002: unique constraint failed (e.g., duplicate name)
  if (err?.code === 'P2002') return jsonError('Business name already exists', 409);
  // Default error handling
  Sentry.captureException?.(err);
  console.error('Prisma error:', err);
  return jsonError('Internal Server Error', 500);
}

// --- GET /api/businesses/:id ---
// Fetch a single business by ID (public endpoint)
export async function GET(_req, { params }) {
  try {
    const id = params?.id;
    if (!isObjectId(id)) return jsonError('Invalid business ID format', 400);

    const business = await prisma.business.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        latitude: true,
        longitude: true,
        logoUrl: true,
        suspended: true,
        suspendedUntil: true,
        type: true,
        hours: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!business) {
      return jsonError('Business not found', 404);
    }

    // Don't return suspended businesses to public
    if (business.suspended) {
      return jsonError('Business not available', 404);
    }

    return NextResponse.json(business, { status: 200 });
  } catch (err) {
    return prismaToHttp(err);
  }
}

// --- PUT /api/businesses/:id ---
// Update a business (partial update with field whitelist)
export async function PUT(request, { params }) {
  try {
    const businessId = params?.id;
    if (!isObjectId(businessId)) return jsonError('Invalid business ID format', 400);

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body', 400);
    }

    // Allow updating these fields only (extend as needed)
    const data = pick(body, [
      'name',
      'description',
      'address',
      'latitude',
      'longitude',
      'logoUrl',
      'type',
      'hours',
      'suspended',
      'suspendedUntil',
    ]);

    // Type conversion for numeric fields
    if (data.latitude !== undefined) {
      data.latitude = Number(data.latitude);
      if (isNaN(data.latitude)) return jsonError('Invalid latitude value', 400);
    }
    if (data.longitude !== undefined) {
      data.longitude = Number(data.longitude);
      if (isNaN(data.longitude)) return jsonError('Invalid longitude value', 400);
    }

    // Ensure we have at least one field to update
    if (Object.keys(data).length === 0) {
      return jsonError('No valid fields provided for update', 400);
    }

    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        latitude: true,
        longitude: true,
        logoUrl: true,
        suspended: true,
        suspendedUntil: true,
        type: true,
        hours: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedBusiness, { status: 200 });
  } catch (err) {
    return prismaToHttp(err);
  }
}

// --- DELETE /api/businesses/:id ---
// Soft delete (recommended) or hard delete a business
export async function DELETE(_request, { params }) {
  try {
    const businessId = params?.id;
    if (!isObjectId(businessId)) return jsonError('Invalid business ID format', 400);

    // ✅ RECOMMENDED: Soft delete (mark as suspended)
    // This is safer when you have related data (services, bookings, reviews, etc.)
    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: { 
        suspended: true,
        suspendedUntil: null // Suspended indefinitely
      },
      select: { 
        id: true, 
        name: true, 
        suspended: true,
        suspendedUntil: true 
      },
    });

    return NextResponse.json(
      { 
        message: 'Business suspended successfully (soft delete)', 
        business: updatedBusiness 
      },
      { status: 200 }
    );

    // ❌ HARD DELETE (uncomment if you really need it - DANGEROUS!)
    // This will cascade delete or fail if there are related records
    /*
    await prisma.business.delete({ 
      where: { id: businessId } 
    });
    
    return NextResponse.json(
      { message: 'Business permanently deleted' }, 
      { status: 200 }
    );
    */

  } catch (err) {
    return prismaToHttp(err);
  }
}