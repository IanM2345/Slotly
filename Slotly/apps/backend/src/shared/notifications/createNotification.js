import { PrismaClient } from '@/generated/prisma';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

/**
 * Logs a notification in the database for a user.
 *
 * @param {Object} params
 * @param {string} params.userId - Target user's ID
 * @param {string} params.type - NotificationType enum value (e.g., BOOKING, COUPON, etc.)
 * @param {string} params.title - Title of the notification
 * @param {string} params.message - Body/message of the notification
 * @returns {Promise<Object>} The created notification record
 */
export async function createNotification({ userId, type, title, message }) {
  if (!userId || !type || !title || !message) {
    const error = new Error('Missing required fields for notification creation');
    Sentry.captureMessage(error.message, { level: 'warning', tags: { module: 'notification' } });
    throw error;
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        read: false,
      },
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);

    Sentry.captureException(error, {
      tags: { module: 'notification' },
      extra: { userId, type, title },
    });

    throw new Error('Failed to create notification');
  }
}
