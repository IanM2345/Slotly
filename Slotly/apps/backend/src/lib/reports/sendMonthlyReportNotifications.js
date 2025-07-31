import { PrismaClient } from '@/generated/prisma';
import { sendEmailNotification } from '@/shared/notifications/sendEmailNotification';
import { twilioClient } from '@/shared/notifications/twilioClient';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

/**
 * Notify business owner via email and SMS
 * @param {string} businessId - The business to notify
 * @param {string} period - e.g. "2025-07"
 * @param {string} fileUrl - e.g. "/reports/slotly-barbershop-2025-07.pdf"
 */
export const sendMonthlyReportNotification = async ({ businessId, period, fileUrl }) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      console.warn(`⚠️ Business not found: ${businessId}`);
      return;
    }

    const owner = await prisma.user.findUnique({
      where: { id: business.ownerId },
    });

    if (!owner) {
      console.warn(`⚠️ Owner not found for business: ${businessId}`);
      return;
    }

    const fullLink = `https://slotly.co.ke${fileUrl}`;

    
    await sendEmailNotification({
      to: owner.email,
      subject: `[Slotly] Your Monthly Performance Report (${period})`,
      body: `
Hi ${owner.name},

Your monthly report for ${period} is ready!

📄 Download it here: ${fullLink}

Thank you for using Slotly.

- Slotly Team
      `.trim(),
    });

    
    if (owner.phone) {
      try {
        await twilioClient.messages.create({
          to: owner.phone,
          from: process.env.TWILIO_PHONE_NUMBER,
          body: `📄 Your Slotly report for ${period} is ready! Download: ${fullLink}`,
        });
      } catch (err) {
        console.warn(`❌ Failed to send SMS to ${owner.phone}:`, err.message);
        Sentry.captureException(err);
      }
    }

    console.log(`✅ Notification sent to ${owner.email} (${owner.phone || 'no phone'})`);

  } catch (error) {
    console.error('❌ Failed to send monthly report notification:', error);
    Sentry.captureException(error);
    throw new Error('Notification failed');
  }
};
