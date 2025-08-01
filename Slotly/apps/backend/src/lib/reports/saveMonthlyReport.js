import { PrismaClient } from '@/generated/prisma';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

/**
 * Save a monthly report metadata entry
 * @param {string} businessId - The business ID
 * @param {string} period - Format: YYYY-MM
 * @param {string} fileUrl - Public path, e.g. /reports/slotly-abc-2025-07.pdf
 */
export const saveMonthlyReport = async ({ businessId, period, fileUrl }) => {
  try {
    
    const existing = await prisma.monthlyReport.findFirst({
      where: { businessId, period },
    });

    if (existing) {
      console.log(`📄 Monthly report already exists for ${businessId} - ${period}`);
      return existing;
    }

  
    const newReport = await prisma.monthlyReport.create({
      data: {
        businessId,
        period,
        fileUrl,
      },
    });

    console.log(`✅ Monthly report saved: ${fileUrl}`);
    return newReport;

  } catch (error) {
    console.error('❌ Failed to save monthly report metadata:', error);
    Sentry.captureException(error);
    throw new Error('Could not save monthly report metadata');
  }
};
