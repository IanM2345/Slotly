import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@/generated/prisma';
import { generateMonthlyReport } from './generateMonthlyReport';
import { saveMonthlyReport } from './saveMonthlyReport';
import { sendMonthlyReportNotification } from './sendMonthlyReportNotification';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

export const runMonthlyReportBatch = async () => {
  const today = new Date();
  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; 

  console.log(`📊 Running Slotly Monthly Report Generator for period: ${period}`);

  const businesses = await prisma.business.findMany({
    where: {
      suspended: false,
      Subscription: {
        isActive: true,
      },
    },
    include: {
      Subscription: true,
    },
  });

  for (const biz of businesses) {
    try {
      const fileUrl = await generateMonthlyReport(biz.id, period); 

      
      await saveMonthlyReport({
        businessId: biz.id,
        period,
        fileUrl,
      });

     
      await sendMonthlyReportNotification({
        businessId: biz.id,
        period,
        fileUrl,
      });

      console.log(`✅ Report generated and sent for ${biz.name}`);

    } catch (error) {
      console.error(`❌ Failed to generate report for ${biz.name}:`, err.message);
      Sentry.captureException(error);
    }
  }

  await prisma.$disconnect();
  console.log('🎉 Monthly report batch complete.');
};
