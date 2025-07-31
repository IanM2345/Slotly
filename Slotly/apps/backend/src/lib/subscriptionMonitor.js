import { PrismaClient } from '@/generated/prisma';
import { markBusinessAsSuspended } from '@/lib/shared/flutterwave';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

export const runSubscriptionMonitor = async () => {
  try {
    const today = new Date();

    const overdueBusinesses = await prisma.business.findMany({
      where: {
        subscriptionStatus: 'active',
        Subscription: {
          endDate: { lt: today },
          isActive: true,
        },
      },
      include: {
        Subscription: true,
      },
    });

    for (const biz of overdueBusinesses) {
      const expiredSince = Math.floor((today - biz.Subscription.endDate) / (1000 * 60 * 60 * 24));

      if (expiredSince >= 2) {
        console.log(`Suspending business ${biz.name} (ID: ${biz.id}) — ${expiredSince} days overdue`);
        await markBusinessAsSuspended(biz.id);
      }
    }

    console.log(`✅ Subscription monitor completed. ${overdueBusinesses.length} businesses checked.`);
  } catch (error) {
    console.error('❌ Error in subscription monitor:', error);
    Sentry.captureException(error);
  } finally {
    await prisma.$disconnect();
  }
};
