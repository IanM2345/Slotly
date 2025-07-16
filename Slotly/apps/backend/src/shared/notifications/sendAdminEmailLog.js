
import { sendEmail } from '@/lib/mailgunClient';

/**
 * Sends an admin log email for compliance or internal tracking.
 * @param {Object} options
 * @param {string} options.subject - Email subject line
 * @param {string} options.message - Body message (can be plain text or simple HTML)
 * @param {string} [options.level] - Optional log level e.g. INFO, WARNING, ERROR
 */
export async function sendAdminEmailLog({ subject, message, level = 'INFO' }) {
  const adminEmail = process.env.SLOTLY_ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn('⚠️ SLOTLY_ADMIN_EMAIL is not set — cannot send admin log email');
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

  await sendEmail({
    to: adminEmail,
    subject: `[Slotly Log] ${subject}`,
    html,
  });
}
