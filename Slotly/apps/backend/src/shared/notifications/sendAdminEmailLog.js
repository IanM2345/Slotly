import { sendEmail } from '@/lib/mailgunClient';
import * as Sentry from '@sentry/nextjs';
import '@/sentry.server.config';

/**
 * Sends an admin log email for compliance or internal tracking.
 *
 * @param {Object} options
 * @param {string} options.subject - Email subject line
 * @param {string} options.message - Plain text or HTML-safe body
 * @param {string} [options.level=INFO] - Log level: INFO, WARNING, ERROR
 */
export async function sendAdminEmailLog({ subject, message, level = 'INFO' }) {
  const adminEmail = process.env.SLOTLY_ADMIN_EMAIL;

  if (!adminEmail) {
    const warn = 'SLOTLY_ADMIN_EMAIL is not set — cannot send admin log email';
    console.warn(`⚠️ ${warn}`);
    Sentry.captureMessage(warn, { level: 'warning', tags: { module: 'email-log' } });
    return;
  }

  const html = `
    <div style="font-family: sans-serif;">
      <h3>[${level}] ${subject}</h3>
      <p>${message}</p>
      <hr />
      <small>This is an automated system log from Slotly.</small>
    </div>
  `;

  try {
    await sendEmail({
      to: adminEmail,
      subject: `[Slotly Log] ${subject}`,
      html,
    });
  } catch (error) {
    console.error('Failed to send admin log email:', error);
    Sentry.captureException(error, {
      tags: { module: 'email-log', level },
      extra: { subject, message },
    });
  }
}
