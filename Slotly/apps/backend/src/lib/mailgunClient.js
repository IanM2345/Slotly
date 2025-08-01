import formData from 'form-data';
import Mailgun from 'mailgun.js';
import * as Sentry from '@sentry/nextjs';

// ❌ REMOVE this if it's still here

const mailgun = new Mailgun(formData);

const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY || '',
});

/**
 * Generic email sender
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

/**
 * OTP wrapper for reusability
 */
export async function sendOTPviaEmail(to, otp) {
  return sendEmail({
    to,
    subject: 'Your Slotly OTP',
    html: `<p>Your one-time password is: <strong>${otp}</strong></p>`,
  });
}
