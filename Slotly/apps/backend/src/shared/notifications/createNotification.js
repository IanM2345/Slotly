
import {PrismaClient}  from '@/generated/prisma';

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
    throw new Error('All parameters (userId, type, title, message) are required');
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
        throw new Error('Failed to create notification');
    }
}