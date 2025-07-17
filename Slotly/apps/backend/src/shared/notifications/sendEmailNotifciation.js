import { sendEmail } from '@/lib/mailgunClient';
import { getNotificationTemplate } from './templates';
import * as Sentry from '@sentry/nextjs';
import '@/sentry.server.config';

/**
 * Sends a templated email notification to a user.
 *
 * @param {Object} options
 * @param {string} options.userEmail - Recipient email
 * @param {string} options.type - Notification type (e.g. "COUPON")
 * @param {string} options.event - Template key (e.g. "COUPON_ASSIGNED")
 * @param {Object} options.data - Data to pass to the template
 */
export async function sendEmailNotification({ userEmail, type, event, data }) {
  if (!userEmail || !type || !event || !data) {
    const errMsg = 'Missing required fields in sendEmailNotification';
    console.warn(errMsg);
    Sentry.captureMessage(errMsg, {
      level: 'warning',
      tags: { module: 'email-notification' },
      extra: { userEmail, type, event },
    });
    return;
  }

  try {
    const template = getNotificationTemplate(event, data);

    if (!template || !template.title || !template.message) {
      const err = new Error(`Missing template for event: ${event}`);
      Sentry.captureException(err, {
        tags: { module: 'email-notification', event },
        extra: { userEmail, type, data },
      });
      return;
    }

    const html = `
      <div style="font-family: sans-serif;">
        <h2>${template.title}</h2>
        <p>${template.message}</p>
        <hr />
        <small>This is an automated email from Slotly. Do not reply.</small>
      </div>
    `;

    await sendEmail({
      to: userEmail,
      subject: `[Slotly] ${template.title}`,
      html,
    });
  } catch (error) {
    console.error('Failed to send email notification:', error);
    Sentry.captureException(error, {
      tags: { module: 'email-notification' },
      extra: { userEmail, type, event, data },
    });
  }
}
