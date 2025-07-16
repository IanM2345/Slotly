
import { sendEmail } from '@/lib/mailgunClient';
import { getNotificationTemplate } from './templates';

/**
 * Sends a templated email notification.
 * @param {Object} options
 * @param {string} options.userEmail - Recipient email
 * @param {string} options.type - NotificationType enum (e.g. "COUPON")
 * @param {string} options.event - Template key (e.g. "COUPON_ASSIGNED")
 * @param {object} options.data - Template data
 */
export async function sendEmailNotification({ userEmail, type, event, data }) {
  const { title, message } = getNotificationTemplate(event, data);

  const html = `
    <div style="font-family: sans-serif;">
      <h2>${title}</h2>
      <p>${message}</p>
      <hr />
      <small>This is an automated email from Slotly. Do not reply.</small>
    </div>
  `;

  await sendEmail({
    to: userEmail,
    subject: `[Slotly] ${title}`,
    html,
  });
}
