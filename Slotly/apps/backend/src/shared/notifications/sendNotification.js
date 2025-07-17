import { createNotification } from './createNotification';
import { sendSMS } from '@/lib/twilioClient';
import * as Sentry from '@sentry/nextjs';
import '@/sentry.server.config';

/**
 * Dispatches a notification to a user across one or more channels.
 *
 * @param {Object} options
 * @param {string} options.userId - Target user ID
 * @param {string} options.type - NotificationType enum value
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification body
 * @param {Object} [options.meta] - Optional metadata
 * @param {boolean} [options.inApp=true] - Create in-app notification
 * @param {boolean} [options.sms=false] - Send SMS via Twilio
 * @param {boolean} [options.email=false] - Send email (future use)
 * @param {string} [options.phone] - Phone number (required if sms is true)
 * @param {string} [options.emailAddress] - Email (required if email is true)
 */
export async function sendNotification({
  userId,
  type,
  title,
  message,
  meta = {},
  inApp = true,
  sms = false,
  email = false,
  phone,
  emailAddress,
}) {
  if (!userId || !type || !title || !message) {
    const error = new Error('Missing required fields: userId, type, title, message');
    Sentry.captureException(error, { tags: { module: 'notification' } });
    throw error;
  }

  try {
    if (inApp) {
      await createNotification({ userId, type, title, message });
    }

    
    if (sms) {
      if (!phone) {
        const smsError = new Error('Missing phone number for SMS notification');
        Sentry.captureMessage(smsError.message, {
          level: 'warning',
          tags: { module: 'notification', channel: 'sms' },
          extra: { userId, title },
        });
        throw smsError;
      }

      await sendSMS({
        toPhoneNumber: phone,
        message: `${title}: ${message}`,
      });
    }

   
    if (email) {
      if (!emailAddress) {
        const emailError = new Error('Missing emailAddress for email notification');
        Sentry.captureMessage(emailError.message, {
          level: 'warning',
          tags: { module: 'notification', channel: 'email' },
          extra: { userId, title },
        });
        throw emailError;
      }

   
      const notImplemented = new Error('Email notification not yet implemented');
      Sentry.captureMessage(notImplemented.message, {
        level: 'info',
        tags: { module: 'notification', channel: 'email' },
      });
      throw notImplemented;
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    Sentry.captureException(error, {
      tags: { module: 'notification' },
      extra: { userId, type, title, sms, email, phone, emailAddress },
    });
    throw new Error('Failed to send notification');
  }
}
