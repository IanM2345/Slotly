
import { createNotification } from "./createNotification";

import {sendSMS} from "@/lib/twilioClient";

/**
 * Dispatches a notification to a user based on provided channels.
 *
 * @param {Object} options
 * @param {string} options.userId - The user receiving the notification
 * @param {string} options.type - NotificationType enum value
 * @param {string} options.title - Title of the notification
 * @param {string} options.message - Body of the notification
 * @param {Object} [options.meta] - Optional extra metadata
 * @param {boolean} [options.inApp=true] - Log to DB
 * @param {boolean} [options.sms=false] - Send SMS via Twilio
 * @param {boolean} [options.email=false] - Send email (stub for now)
 * @param {string} [options.phone] - Required if SMS is true
 * @param {string} [options.emailAddress] - Required if email is true
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
    throw new Error('userId, type, title, and message are required parameters');
  }
  try {
    
    if (inApp) {
      await createNotification({ userId, type, title, message });
    }
    if (sms&& phone) {
      if (!phone) {
        throw new Error('phone is required when sms is true');
      }
        await sendSMS({
            to: phone,
            body: `${title}: ${message}`,
        });
    }
    if (email && emailAddress) {
      // Email functionality is not implemented yet
      throw new Error('Email functionality is not implemented yet');
    }
    } catch (error) {
    console.error('Error sending notification:', error);
    throw new Error('Failed to send notification');
  }
  }