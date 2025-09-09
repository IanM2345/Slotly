import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { getPlanFeatures } from '@/shared/subscriptionPlanUtils';
import { createNotification } from '@/shared/notifications/createNotification';

const prisma = new PrismaClient();

async function getBusinessFromToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  const { valid, decoded } = await verifyToken(token);
  
  if (!valid || decoded.role !== 'BUSINESS_OWNER') {
    return { error: 'Unauthorized', status: 403 };
  }

  const ownerId = decoded?.userId ?? decoded?.id ?? decoded?.sub;
  const businessId = decoded?.businessId ?? decoded?.bizId;

  // Prefer explicit businessId from token; otherwise pick most recent for owner
  const business = businessId
    ? await prisma.business.findUnique({ where: { id: businessId } })
    : await prisma.business.findFirst({
        where: { ownerId },
        orderBy: { createdAt: 'desc' },
      });

  if (!business) {
    return { error: 'Business not found', status: 404 }; 
  }

  return { business };
}

export async function POST(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    // Normalize plan key before passing to getPlanFeatures
    const planKey = String(business.plan ?? 'FREE').trim().toUpperCase();
    const features = getPlanFeatures(planKey) || {};
    
    const lvl = Number((planKey.match(/^LEVEL_(\d+)$/) || [])[1]);
    const canUseBundlesGate = features.canUseBundles ?? (Number.isFinite(lvl) && lvl >= 2);

    // Optional temporary dev override header to bypass gate while testing
    const devOverride = request.headers.get('x-bundles-override') === 'allow';
    
    // Add debug context to Sentry
    Sentry.setContext('plan-check', { rawPlan: business.plan, planKey, lvl, features, canUseBundlesGate });
    
    if (!canUseBundlesGate && !devOverride) {
      Sentry.captureMessage(`Bundle creation blocked for business ${business.id} (Plan: ${business.plan})`);

      await createNotification({
        userId: business.ownerId,
        type: 'SYSTEM',
        title: 'Bundles Feature Unavailable',
        message: `Your plan (${business.plan}) does not support service bundles. Upgrade to unlock this feature.`,
      });

      return NextResponse.json({
        code: 'BUNDLES_NOT_ALLOWED',
        error: 'Your current plan does not allow creating service bundles.',
        limits: { plan: business.plan, canUseBundles: false, maxBundles: null, currentCount: null },
        suggestion: 'Upgrade to a higher plan to enable this feature.',
        debug: { planKey, lvl, features }, // Remove in production
      }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, price, duration, serviceIds } = body;

    if (name == null || price == null || duration == null || !Array.isArray(serviceIds)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (serviceIds.length < 2) {
      return NextResponse.json({ error: 'A bundle must include at least 2 services' }, { status: 400 });
    }

    // Optional per-plan bundle cap (if exposed by getPlanFeatures)
    if (Number.isFinite(features.maxBundles)) {
      const count = await prisma.serviceBundle.count({ where: { businessId: business.id } });
      if (count >= features.maxBundles) {
        return NextResponse.json({
          code: 'BUNDLE_LIMIT_REACHED',
          error: `Bundle limit reached (${features.maxBundles}).`,
          limits: { plan: business.plan, maxBundles: features.maxBundles, currentCount: count, remaining: 0 },
          suggestion: 'Upgrade your plan to create more bundles.',
        }, { status: 403 });
      }
    }

    // Verify all services belong to this business
    const svcCount = await prisma.service.count({
      where: { businessId: business.id, id: { in: serviceIds } },
    });
    if (svcCount !== serviceIds.length) {
      return NextResponse.json({ error: 'One or more services do not belong to your business' }, { status: 400 });
    }

    const bundle = await prisma.serviceBundle.create({
      data: {
        name,
        ...(description ? { description } : {}), // avoid sending undefined
        price: parseInt(price, 10),
        duration: parseInt(duration, 10),   // accepts 0
        businessId: business.id,
        bundleServices: {                    // ✅ Fixed: use bundleServices
          create: serviceIds.map((id, index) => ({
            service: { connect: { id } },
            position: index + 1,
          })),
        },
      },
      include: {
        bundleServices: {                    // ✅ Fixed: use bundleServices
          include: {
            service: true,
          },
        },
      },
    });

    return NextResponse.json(bundle, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error('POST /manager/bundles error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    // Normalize plan key before passing to getPlanFeatures
    const planKey = String(business.plan ?? 'FREE').trim().toUpperCase();
    const features = getPlanFeatures(planKey) || {};
    
    const lvl = Number((planKey.match(/^LEVEL_(\d+)$/) || [])[1]);
    const canUseBundlesGate = features.canUseBundles ?? (Number.isFinite(lvl) && lvl >= 2);

    // Optional temporary dev override header to bypass gate while testing
    const devOverride = request.headers.get('x-bundles-override') === 'allow';

    Sentry.setContext('plan-check', { rawPlan: business.plan, planKey, lvl, features, canUseBundlesGate });
    
    if (!canUseBundlesGate && !devOverride) {
       Sentry.captureMessage(`Bundle access blocked for business ${business.id} (Plan: ${business.plan})`);

      return NextResponse.json({
        code: 'BUNDLES_NOT_ALLOWED',
        error: 'Access to bundles is not available on your current plan.',
        limits: { plan: business.plan, canUseBundles: false, maxBundles: null, currentCount: null },
        suggestion: 'Upgrade to view and manage bundles.',
        debug: { planKey, lvl, features }, // Remove in production
      }, { status: 403 });
    }

    const bundles = await prisma.serviceBundle.findMany({
      where: { businessId: business.id },
      include: {
        bundleServices: {                    // ✅ Fixed: use bundleServices
          include: {
            service: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ bundles }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error('GET /manager/bundles error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Bundle ID is required' }, { status: 400 });
    }

    const bundle = await prisma.serviceBundle.findFirst({
      where: {
        id,
        businessId: business.id,
      },
      include: {
        bundleServices: true,                // ✅ Fixed: use bundleServices
      },
    });

    if (!bundle) {
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
    }

    await prisma.serviceBundle.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Bundle deleted successfully' }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error('DELETE /manager/bundles error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}