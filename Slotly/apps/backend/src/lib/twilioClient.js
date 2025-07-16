
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_FROM_PHONE;

if (!accountSid || !authToken || !fromPhone) {
  throw new Error('Twilio credentials are not set in environment variables');
}

const twilioClient = twilio(accountSid, authToken);

/**
 * Sends an SMS message using Twilio
 * @param {string} toPhoneNumber - The recipient phone number in E.164 format
 * @param {string} message - The message to send
 * @returns {Promise<object>} - Twilio response
 */

export async function sendSms(toPhoneNumber, message) {
  if (!toPhoneNumber || !message) {
    throw new Error('Both toPhoneNumber and message are required');
  }
  try{
    const result = await twilioClient.messages.create({
      body: message,
      from: fromPhone,
        to: toPhoneNumber,
    });
    return result;
  }catch (error) {
    console.error('Error sending SMS:', error);
    throw new Error('Failed to send SMS');
  }
}

export default twilioClient;