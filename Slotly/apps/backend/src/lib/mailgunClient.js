import formData from 'form-data';
import Mailgun from 'mailgun.js';
import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';

const mailgun = new Mailgun(formData);

const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY || '',
});

/**
 * Send an email via Mailgun
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email body (HTML)
 */
export async function sendEmail({ to, subject, html }) {
  const domain = process.env.MAILGUN_DOMAIN;

  if (!domain || !process.env.MAILGUN_API_KEY) {
    console.warn('Missing Mailgun configuration. Email not sent.');
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV EMAIL MOCK] ➜ To: ${to}\nSubject: ${subject}\nHTML:\n${html}`);
    return;
  }

  try {
    return await mg.messages.create(domain, {
      from: `Slotly <no-reply@${domain}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Failed to send email via Mailgun:', error);
    Sentry.captureException(error);
    throw new Error('Email sending failed');
  }
}
