import twilio from 'twilio';
import * as Sentry from '@sentry/nextjs';

// ❌ REMOVE this line too:

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_FROM_PHONE;

if (!accountSid || !authToken || !fromPhone) {
  throw new Error('Twilio credentials are not set in environment variables');
}

const twilioClient = twilio(accountSid, authToken);

/**
 * Sends a generic SMS message using Twilio
 */
export async function sendSms(toPhoneNumber, message) {
  if (!toPhoneNumber || !message) {
    throw new Error('Both toPhoneNumber and message are required');
  }

  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV SMS MOCK] To: ${toPhoneNumber} | Message: ${message}`);
      return { sid: 'MOCK_SID', status: 'mocked', to: toPhoneNumber };
    }

    return await twilioClient.messages.create({
      body: message,
      from: fromPhone,
      to: toPhoneNumber,
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    Sentry.captureException(error);
    throw new Error('Failed to send SMS');
  }
}

/**
 * Specific helper for OTP
 */
export async function sendOTPviaSMS(toPhoneNumber, otp) {
  const message = `Your Slotly OTP is: ${otp}`;
  return sendSms(toPhoneNumber, message);
}
