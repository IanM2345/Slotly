// File: apps/backend/src/app/api/staff/services/route.js
// Staff assigned services endpoint

import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { NextResponse } from 'next/server';
import { getStaffContext } from '../route';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    // Get services assigned to this staff member
    const serviceStaff = await prisma.serviceStaff.findMany({
      where: {
        staffId: ctx.userId,
        businessId: ctx.business.id
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
            category: true,
            available: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        service: { name: 'asc' }
      }
    });

    const services = serviceStaff.map(ss => ({
      ...ss.service,
      assignedAt: ss.createdAt
    }));

    // Get booking statistics for assigned services
    const serviceStats = await Promise.all(
      services.map(async (service) => {
        const [bookingCount, revenue, recentBookings] = await Promise.all([
          prisma.booking.count({
            where: {
              serviceId: service.id,
              staffId: ctx.userId,
              businessId: ctx.business.id,
              status: 'COMPLETED'
            }
          }),
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
              status: 'SUCCESS',
              booking: {
                serviceId: service.id,
                staffId: ctx.userId,
                businessId: ctx.business.id,
                status: 'COMPLETED'
              }
            }
          }),
          prisma.booking.count({
            where: {
              serviceId: service.id,
              staffId: ctx.userId,
              businessId: ctx.business.id,
              startTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
              status: 'COMPLETED'
            }
          })
        ]);

        return {
          ...service,
          stats: {
            totalBookings: bookingCount || 0,
            totalRevenue: revenue._sum.amount || 0,
            recentBookings: recentBookings || 0,
            averageBookingValue: bookingCount > 0 ? 
              Math.round((revenue._sum.amount || 0) / bookingCount) : 0
          }
        };
      })
    );

    // Calculate overall service statistics
    const overallStats = {
      totalServices: serviceStats.length,
      totalBookings: serviceStats.reduce((sum, s) => sum + s.stats.totalBookings, 0),
      totalRevenue: serviceStats.reduce((sum, s) => sum + s.stats.totalRevenue, 0),
      averageServicePrice: services.length > 0 ? 
        Math.round(services.reduce((sum, s) => sum + s.price, 0) / services.length) : 0
    };

    return NextResponse.json({
      services: serviceStats || [],
      stats: overallStats,
      business: ctx.business
    });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}